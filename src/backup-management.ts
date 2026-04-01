import { lstat, readFile, readdir, rm } from "fs/promises";
import path from "path";

import { config } from "./config.js";
import { summarizeSite } from "./local-sites.js";
import { isReadablePath } from "./process-utils.js";
import type {
  BackupArtifactCategory,
  BackupScope,
  SiteContext,
} from "./types.js";

export const backupArtifactCategories = [
  "full_backup",
  "database_backup",
  "pre_restore_backup",
  "database_export",
  "pre_import_backup",
  "sql_file",
] as const satisfies readonly BackupArtifactCategory[];

interface BackupManifestSummary {
  format?: string;
  createdAt?: string;
  scope?: BackupScope;
}

interface BackupArtifact {
  path: string;
  absolutePath: string;
  kind: "file" | "directory";
  category: BackupArtifactCategory;
  createdAt: string;
  modifiedAt: string;
  sizeBytes: number;
  manifestPath: string | null;
  manifestCreatedAt: string | null;
  scope: BackupScope | null;
}

export async function listManagedBackups(
  context: SiteContext,
  options: {
    rootPath?: string;
  } = {},
) {
  const backupRoot = resolveManagedBackupRoot(context, options.rootPath);

  if (!(await isReadablePath(backupRoot))) {
    return {
      site: summarizeSite(context.site),
      selectionMethod: context.selectionMethod,
      accessProfile: config.profile,
      backupRoot,
      artifacts: [],
    };
  }

  const artifacts = await discoverBackupArtifacts(backupRoot);

  return {
    site: summarizeSite(context.site),
    selectionMethod: context.selectionMethod,
    accessProfile: config.profile,
    backupRoot,
    artifacts,
  };
}

export async function deleteManagedBackup(
  context: SiteContext,
  options: {
    backupPath: string;
    rootPath?: string;
    missingOk?: boolean;
  },
) {
  const inventory = await listManagedBackups(context, {
    rootPath: options.rootPath,
  });
  const normalizedBackupPath = normalizeBackupRelativePath(options.backupPath);
  const artifact = inventory.artifacts.find(
    (candidate) => candidate.path === normalizedBackupPath,
  );

  if (!artifact) {
    if (options.missingOk) {
      return {
        ...inventory,
        targetPath: normalizedBackupPath,
        deleted: false,
        existedBefore: false,
        missingOk: true,
      };
    }

    throw new Error(
      `No managed backup artifact matched '${options.backupPath}' under '${inventory.backupRoot}'.`,
    );
  }

  await rm(artifact.absolutePath, { recursive: true, force: false });

  return {
    ...inventory,
    targetPath: artifact.path,
    deleted: true,
    existedBefore: true,
    deletedArtifact: artifact,
    missingOk: options.missingOk ?? false,
  };
}

export async function cleanupManagedBackups(
  context: SiteContext,
  options: {
    rootPath?: string;
    categories?: BackupArtifactCategory[];
    olderThanDays?: number;
    keepLatest?: number;
    dryRun?: boolean;
  } = {},
) {
  if (options.olderThanDays === undefined && options.keepLatest === undefined) {
    throw new Error(
      "cleanup_backups requires olderThanDays, keepLatest, or both.",
    );
  }

  const inventory = await listManagedBackups(context, {
    rootPath: options.rootPath,
  });
  const categories = new Set(options.categories || backupArtifactCategories);
  const eligibleArtifacts = inventory.artifacts.filter((artifact) =>
    categories.has(artifact.category),
  );
  const keepLatest = options.keepLatest ? Math.max(options.keepLatest, 0) : 0;
  const thresholdMs =
    options.olderThanDays !== undefined
      ? Date.now() - options.olderThanDays * 24 * 60 * 60 * 1000
      : null;

  const retainedPaths = new Set(
    eligibleArtifacts.slice(0, keepLatest).map((artifact) => artifact.path),
  );
  const cleanupCandidates = eligibleArtifacts.filter((artifact) => {
    if (retainedPaths.has(artifact.path)) {
      return false;
    }

    if (thresholdMs === null) {
      return true;
    }

    return Date.parse(artifact.createdAt) < thresholdMs;
  });

  if (!options.dryRun) {
    for (const artifact of cleanupCandidates) {
      await rm(artifact.absolutePath, { recursive: true, force: false });
    }
  }

  return {
    ...inventory,
    categories: Array.from(categories),
    olderThanDays: options.olderThanDays ?? null,
    keepLatest: options.keepLatest ?? null,
    dryRun: options.dryRun ?? false,
    deletedCount: options.dryRun ? 0 : cleanupCandidates.length,
    reclaimedBytesEstimate: cleanupCandidates.reduce(
      (total, artifact) => total + artifact.sizeBytes,
      0,
    ),
    deletedArtifacts: options.dryRun ? [] : cleanupCandidates,
    candidateArtifacts: cleanupCandidates,
    retainedArtifacts: eligibleArtifacts.filter((artifact) =>
      retainedPaths.has(artifact.path),
    ),
  };
}

export function resolveManagedBackupRoot(
  context: SiteContext,
  rootPath?: string,
) {
  if (rootPath) {
    return path.resolve(rootPath);
  }

  if (config.backupsDirOverride) {
    return path.resolve(config.backupsDirOverride);
  }

  return path.join(context.site.absolutePath, "localwp-mcp-backups");
}

async function discoverBackupArtifacts(backupRoot: string) {
  const entries = await readdir(backupRoot, { withFileTypes: true });
  const artifacts: BackupArtifact[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absoluteEntryPath = path.join(backupRoot, entry.name);

    if (entry.isDirectory()) {
      const manifestPath = path.join(absoluteEntryPath, "manifest.json");

      if (await isReadablePath(manifestPath)) {
        artifacts.push(await buildBackupDirectoryArtifact(backupRoot, absoluteEntryPath));
        continue;
      }

      if (entry.name === "database-exports" || entry.name === "pre-import") {
        artifacts.push(
          ...(await collectSqlFileArtifacts(
            backupRoot,
            absoluteEntryPath,
            entry.name === "pre-import" ? "pre_import_backup" : "database_export",
          )),
        );
      }
      continue;
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".sql") {
      artifacts.push(await buildSqlFileArtifact(backupRoot, absoluteEntryPath, "sql_file"));
    }
  }

  return artifacts.sort(
    (left, right) =>
      Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
      left.path.localeCompare(right.path),
  );
}

async function collectSqlFileArtifacts(
  backupRoot: string,
  directoryPath: string,
  category: BackupArtifactCategory,
) {
  const sqlArtifacts: BackupArtifact[] = [];
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const absoluteEntryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      sqlArtifacts.push(...(await collectSqlFileArtifacts(backupRoot, absoluteEntryPath, category)));
      continue;
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".sql") {
      sqlArtifacts.push(
        await buildSqlFileArtifact(backupRoot, absoluteEntryPath, category),
      );
    }
  }

  return sqlArtifacts;
}

async function buildBackupDirectoryArtifact(
  backupRoot: string,
  absolutePath: string,
): Promise<BackupArtifact> {
  const manifestPath = path.join(absolutePath, "manifest.json");
  const manifest = await readManifest(manifestPath);
  const stats = await lstat(absolutePath);

  return {
    path: normalizeBackupRelativePath(path.relative(backupRoot, absolutePath)),
    absolutePath,
    kind: "directory",
    category: inferDirectoryCategory(absolutePath, manifest.scope),
    createdAt: manifest.createdAt || stats.mtime.toISOString(),
    modifiedAt: stats.mtime.toISOString(),
    sizeBytes: await calculatePathSize(absolutePath),
    manifestPath,
    manifestCreatedAt: manifest.createdAt || null,
    scope: manifest.scope || null,
  };
}

async function buildSqlFileArtifact(
  backupRoot: string,
  absolutePath: string,
  category: BackupArtifactCategory,
): Promise<BackupArtifact> {
  const stats = await lstat(absolutePath);

  return {
    path: normalizeBackupRelativePath(path.relative(backupRoot, absolutePath)),
    absolutePath,
    kind: "file",
    category,
    createdAt: stats.mtime.toISOString(),
    modifiedAt: stats.mtime.toISOString(),
    sizeBytes: stats.size,
    manifestPath: null,
    manifestCreatedAt: null,
    scope: null,
  };
}

async function readManifest(manifestPath: string) {
  const raw = await readFile(manifestPath, "utf8");
  return JSON.parse(raw) as BackupManifestSummary;
}

function inferDirectoryCategory(
  absolutePath: string,
  scope: BackupScope | undefined,
): BackupArtifactCategory {
  const directoryName = path.basename(absolutePath).toLowerCase();

  if (directoryName.includes("pre-restore")) {
    return "pre_restore_backup";
  }

  if (scope === "full") {
    return "full_backup";
  }

  return "database_backup";
}

async function calculatePathSize(absolutePath: string): Promise<number> {
  const stats = await lstat(absolutePath);

  if (!stats.isDirectory()) {
    return stats.size;
  }

  const entries = await readdir(absolutePath, { withFileTypes: true });
  let total = 0;

  for (const entry of entries) {
    total += await calculatePathSize(path.join(absolutePath, entry.name));
  }

  return total;
}

function normalizeBackupRelativePath(relativePath: string) {
  return relativePath.replaceAll(path.sep, "/");
}
