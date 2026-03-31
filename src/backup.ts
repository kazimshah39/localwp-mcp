import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";

import { config } from "./config.js";
import { summarizeSite } from "./local-sites.js";
import { ensureMysqlReady } from "./mysql.js";
import { assertReadable, isReadablePath, spawnCommand } from "./process-utils.js";
import type { BackupScope, SiteContext } from "./types.js";

const defaultBackupDirectories = ["app", "conf", "logs"] as const;
const backupManifestVersion = "localwp-mcp-backup-v1";

interface BackupManifest {
  format: string;
  createdAt?: string;
  scope?: BackupScope;
  accessProfile?: string;
  site?: Record<string, unknown>;
  database?: {
    file?: string;
    absolutePath?: string;
    source?: string;
  };
  copiedDirectories?: string[];
  notes?: string[];
}

interface ResolvedBackupSource {
  inputPath: string;
  sqlFilePath: string;
  backupDir: string | null;
  manifestPath: string | null;
  manifest: BackupManifest | null;
  copiedDirectories: string[];
}

export async function createSiteBackup(
  context: SiteContext,
  options: {
    scope?: BackupScope;
    outputDir?: string;
    label?: string;
  } = {},
) {
  const scope = options.scope || "full";
  await ensureMysqlReady(context);

  const backupRoot = resolveBackupRoot(context, options.outputDir);
  const backupName = buildBackupDirectoryName(context.site.name, scope, options.label);
  const backupDir = path.join(backupRoot, backupName);
  const copiedDirectories: string[] = [];

  await mkdir(backupDir, { recursive: true });

  let databaseFileRelativePath = "database.sql";

  if (scope === "full") {
    for (const directoryName of defaultBackupDirectories) {
      const sourcePath = path.join(context.site.absolutePath, directoryName);

      if (!(await isReadablePath(sourcePath))) {
        continue;
      }

      await cp(sourcePath, path.join(backupDir, directoryName), {
        recursive: true,
      });
      copiedDirectories.push(directoryName);
    }

    databaseFileRelativePath = path.join(
      "app",
      "sql",
      `${sanitizeBackupSegment(context.site.name)}-backup.sql`,
    );
  }

  const databaseFilePath = path.join(backupDir, databaseFileRelativePath);
  const exportResult = await exportDatabase(context, {
    destinationPath: databaseFilePath,
  });

  const manifest = {
    format: "localwp-mcp-backup-v1",
    createdAt: new Date().toISOString(),
    scope,
    accessProfile: config.profile,
    site: summarizeSite(context.site),
    database: {
      file: databaseFileRelativePath,
      absolutePath: exportResult.outputPath,
      source: "mysqldump",
    },
    copiedDirectories,
    notes:
      scope === "full"
        ? [
            "This backup folder mirrors a Local site layout closely enough to inspect manually or zip for Local-friendly restore workflows.",
            "Use db_import with the backup directory path to import the SQL dump from this backup.",
          ]
        : [
            "This backup contains a fresh SQL export only.",
            "Use db_import with this backup directory path or the SQL file path.",
          ],
  };

  const manifestPath = path.join(backupDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  return {
    backupDir,
    manifestPath,
    scope,
    databaseFilePath: exportResult.outputPath,
    copiedDirectories,
  };
}

export async function restoreSiteBackup(
  context: SiteContext,
  sourcePath: string,
  options: {
    restoreFiles?: boolean;
    replaceDirectories?: boolean;
    backupBeforeRestore?: boolean;
  } = {},
) {
  await ensureMysqlReady(context);

  const resolvedSource = await resolveBackupSource(sourcePath);
  const restoreFiles = options.restoreFiles ?? true;
  const replaceDirectories = options.replaceDirectories ?? true;
  const fileRestoreAvailable =
    restoreFiles &&
    Boolean(
      resolvedSource.backupDir &&
        resolvedSource.manifest?.scope === "full" &&
        resolvedSource.copiedDirectories.length > 0,
    );
  let preRestoreBackup: Awaited<ReturnType<typeof createSiteBackup>> | null = null;

  if (options.backupBeforeRestore ?? true) {
    preRestoreBackup = await createSiteBackup(context, {
      scope: fileRestoreAvailable ? "full" : "database",
      label: "pre-restore",
    });
  }

  if (fileRestoreAvailable && resolvedSource.backupDir) {
    await restoreDirectoriesFromBackup(
      context,
      resolvedSource.backupDir,
      resolvedSource.copiedDirectories,
      replaceDirectories,
    );
  }

  const importResult = await importDatabase(context, resolvedSource.sqlFilePath, {
    backupBeforeImport: false,
  });

  return {
    sourcePath: resolvedSource.inputPath,
    sqlFilePath: resolvedSource.sqlFilePath,
    backupDir: resolvedSource.backupDir,
    manifestPath: resolvedSource.manifestPath,
    restoredFiles: fileRestoreAvailable ? resolvedSource.copiedDirectories : [],
    replaceDirectories,
    restartRecommended: fileRestoreAvailable,
    preRestoreBackupDir: preRestoreBackup?.backupDir || null,
    preRestoreManifestPath: preRestoreBackup?.manifestPath || null,
    stdout: importResult.stdout,
    stderr: importResult.stderr,
  };
}

export async function exportDatabase(
  context: SiteContext,
  options: {
    destinationPath?: string;
    label?: string;
  } = {},
) {
  await ensureMysqlReady(context);

  const outputPath = await resolveExportPath(context, options.destinationPath, {
    label: options.label,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });

  const result = await executeMysqlExport(context, outputPath);

  return {
    outputPath,
    stdout: result.stdout,
    stderr: result.stderr || null,
  };
}

export async function importDatabase(
  context: SiteContext,
  sourcePath: string,
  options: {
    backupBeforeImport?: boolean;
  } = {},
) {
  await ensureMysqlReady(context);

  const resolvedSourcePath = await resolveImportSourcePath(sourcePath);
  let backupPath: string | null = null;

  if (options.backupBeforeImport ?? true) {
    const backupResult = await exportDatabase(context, {
      destinationPath: path.join(
        resolveBackupRoot(context),
        "pre-import",
        `${sanitizeBackupSegment(context.site.name)}-before-import-${createTimestamp()}.sql`,
      ),
    });
    backupPath = backupResult.outputPath;
  }

  const result = await executeMysqlImport(context, resolvedSourcePath);

  return {
    sourcePath: resolvedSourcePath,
    backupPath,
    stdout: result.stdout,
    stderr: result.stderr || null,
  };
}

export function buildBackupDirectoryName(
  siteName: string,
  scope: BackupScope,
  label?: string,
  createdAt = new Date(),
) {
  const parts = [
    sanitizeBackupSegment(siteName),
    scope,
    formatTimestamp(createdAt),
  ];

  if (label) {
    parts.push(sanitizeBackupSegment(label));
  }

  return parts.filter(Boolean).join("-");
}

export function sanitizeBackupSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export async function resolveImportSourcePath(inputPath: string) {
  const resolvedSource = await resolveBackupSource(inputPath);
  return resolvedSource.sqlFilePath;
}

export async function resolveBackupSource(
  inputPath: string,
): Promise<ResolvedBackupSource> {
  const absolutePath = path.resolve(inputPath);

  await assertReadable(
    absolutePath,
    "The backup source path is not readable",
  );

  const fileStats = await stat(absolutePath);

  if (fileStats.isFile()) {
    if (path.extname(absolutePath).toLowerCase() !== ".sql") {
      throw new Error(
        "restore_backup and db_import expect a .sql file or a backup directory.",
      );
    }

    return {
      inputPath: absolutePath,
      sqlFilePath: absolutePath,
      backupDir: null,
      manifestPath: null,
      manifest: null,
      copiedDirectories: [],
    };
  }

  if (!fileStats.isDirectory()) {
    throw new Error(
      "restore_backup and db_import expect a readable .sql file or directory.",
    );
  }

  const manifestPath = path.join(absolutePath, "manifest.json");
  const manifest =
    (await isReadablePath(manifestPath))
      ? ((JSON.parse(await readFile(manifestPath, "utf8")) as BackupManifest) ??
          null)
      : null;

  if (manifest?.format && manifest.format !== backupManifestVersion) {
    throw new Error(
      `Unsupported backup manifest format '${manifest.format}'.`,
    );
  }

  const relativeDatabaseFile = manifest?.database?.file;

  if (relativeDatabaseFile) {
    const manifestSqlPath = path.join(absolutePath, relativeDatabaseFile);
    await assertReadable(
      manifestSqlPath,
      "The SQL file referenced by this backup manifest is not readable",
    );

    return {
      inputPath: absolutePath,
      sqlFilePath: manifestSqlPath,
      backupDir: absolutePath,
      manifestPath,
      manifest,
      copiedDirectories: normalizeCopiedDirectories(manifest?.copiedDirectories),
    };
  }

  const sqlFiles = await findSqlFiles(absolutePath);

  if (sqlFiles.length === 1) {
    return {
      inputPath: absolutePath,
      sqlFilePath: sqlFiles[0],
      backupDir: absolutePath,
      manifestPath: manifest ? manifestPath : null,
      manifest,
      copiedDirectories: normalizeCopiedDirectories(manifest?.copiedDirectories),
    };
  }

  if (sqlFiles.length === 0) {
    throw new Error(
      "No SQL file was found in that directory. Pass a .sql file path or a backup directory created by backup_site.",
    );
  }

  throw new Error(
    "Multiple SQL files were found in that directory. Pass the exact .sql file path you want to import.",
  );
}

async function resolveExportPath(
  context: SiteContext,
  destinationPath: string | undefined,
  options: {
    label?: string;
  } = {},
) {
  const defaultFileName = `${sanitizeBackupSegment(context.site.name)}-${createTimestamp()}${options.label ? `-${sanitizeBackupSegment(options.label)}` : ""}.sql`;

  if (!destinationPath) {
    return path.join(resolveBackupRoot(context), "database-exports", defaultFileName);
  }

  const absolutePath = path.resolve(destinationPath);

  if (await isReadablePath(absolutePath)) {
    const existingStats = await stat(absolutePath);

    if (existingStats.isDirectory()) {
      return path.join(absolutePath, defaultFileName);
    }
  }

  if (path.extname(absolutePath).toLowerCase() === ".sql") {
    return absolutePath;
  }

  return path.join(absolutePath, defaultFileName);
}

function resolveBackupRoot(context: SiteContext, outputDir?: string) {
  if (outputDir) {
    return path.resolve(outputDir);
  }

  if (config.backupsDirOverride) {
    return path.resolve(config.backupsDirOverride);
  }

  return path.join(context.site.absolutePath, "localwp-mcp-backups");
}

async function findSqlFiles(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const sqlFiles: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      sqlFiles.push(...(await findSqlFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".sql") {
      sqlFiles.push(entryPath);
    }
  }

  return sqlFiles.sort();
}

async function restoreDirectoriesFromBackup(
  context: SiteContext,
  backupDir: string,
  copiedDirectories: string[],
  replaceDirectories: boolean,
) {
  for (const directoryName of copiedDirectories) {
    const sourcePath = path.join(backupDir, directoryName);
    const targetPath = path.join(context.site.absolutePath, directoryName);

    await assertReadable(
      sourcePath,
      `The backup directory is missing the expected '${directoryName}' folder`,
    );

    if (replaceDirectories) {
      await rm(targetPath, { recursive: true, force: true });
    }

    await cp(sourcePath, targetPath, {
      recursive: true,
      force: true,
    });
  }
}

function formatTimestamp(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "-");
}

function createTimestamp() {
  return formatTimestamp(new Date());
}

function normalizeCopiedDirectories(value: string[] | undefined) {
  return (value || []).filter((directoryName) =>
    defaultBackupDirectories.includes(
      directoryName as (typeof defaultBackupDirectories)[number],
    ),
  );
}

function buildMysqlConnectionArgs(context: SiteContext) {
  if (context.mysqlSocket) {
    return ["--protocol=SOCKET", `--socket=${context.mysqlSocket}`];
  }

  const args = [
    "--protocol=TCP",
    `--host=${context.mysqlHost || config.defaultMysqlHost}`,
  ];

  if (context.mysqlPort) {
    args.push(`--port=${context.mysqlPort}`);
  }

  return args;
}

function getMysqldumpPath(context: SiteContext) {
  return path.join(
    path.dirname(context.mysql.binaryPath),
    process.platform === "win32" ? "mysqldump.exe" : "mysqldump",
  );
}

async function executeMysqlExport(context: SiteContext, outputPath: string) {
  const args = [
    `--defaults-file=${context.mysqlDefaultsFile}`,
    "--default-character-set=utf8mb4",
    "--add-drop-table",
    `--result-file=${outputPath}`,
    ...buildMysqlConnectionArgs(context),
    context.database,
  ];
  const result = await spawnCommand(getMysqldumpPath(context), args, {
    cwd: context.wpRoot,
    env: process.env,
  });

  if (result.timedOut) {
    throw new Error(
      `Database export timed out after ${config.defaultTimeoutMs / 1000}s for site '${context.site.name}'.`,
    );
  }

  if (result.exitCode !== 0) {
    throw new Error(
      [
        `mysqldump exited with code ${result.exitCode} for site '${context.site.name}'.`,
        result.stderr,
        result.stdout,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }

  return result;
}

async function executeMysqlImport(context: SiteContext, sourcePath: string) {
  const args = [
    `--defaults-file=${context.mysqlDefaultsFile}`,
    "--default-character-set=utf8mb4",
    ...buildMysqlConnectionArgs(context),
    context.database,
  ];
  const result = await spawnCommand(context.mysql.binaryPath, args, {
    cwd: context.wpRoot,
    env: process.env,
    stdinFilePath: sourcePath,
  });

  if (result.timedOut) {
    throw new Error(
      `Database import timed out after ${config.defaultTimeoutMs / 1000}s for site '${context.site.name}'.`,
    );
  }

  if (result.exitCode !== 0) {
    throw new Error(
      [
        `mysql exited with code ${result.exitCode} for site '${context.site.name}'.`,
        result.stderr,
        result.stdout,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }

  return result;
}
