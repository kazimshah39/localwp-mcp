import { readFile, readdir } from "fs/promises";
import path from "path";

import { config } from "./config.js";
import {
  getExecutableCandidates,
  getLegacySiteBinariesDirs,
  getLightningServiceBinaryCandidates,
  getPlatformBinDirCandidates,
} from "./platform-paths.js";
import {
  assertReadable,
  ensureReadableDirectory,
  isExecutablePath,
  isReadablePath,
} from "./process-utils.js";
import type {
  LocalSite,
  LocalSiteRecord,
  ServiceBinary,
  SiteContext,
  SiteSelection,
} from "./types.js";

export async function loadLocalSites() {
  const [sitesPayload, statusesPayload] = await Promise.all([
    readJsonFile<Record<string, LocalSiteRecord>>(config.localSitesJson),
    readJsonFile<Record<string, string>>(config.localSiteStatusesJson, {}),
  ]);

  return Object.values(sitesPayload)
    .map((site) => ({
      ...site,
      absolutePath: expandHome(site.path),
      wpRoot: path.join(expandHome(site.path), "app", "public"),
      runtimeDir: path.join(config.localRunDir, site.id),
      status: statusesPayload[site.id] || "unknown",
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function buildSiteContext(selection: SiteSelection) {
  const site = await resolveSite(selection);
  const runtimeDir = path.join(config.localRunDir, site.id);
  const php = await resolveServiceBinary(
    "php",
    site.services?.php?.version,
    "php",
  );
  const mysql = await resolveServiceBinary(
    "mysql",
    site.services?.mysql?.version,
    "mysql",
  );
  const phpConfigDir = path.join(runtimeDir, "conf", "php");
  const mysqlDefaultsFile = path.join(runtimeDir, "conf", "mysql", "my.cnf");
  const mysqlSocket =
    config.platform === "win32"
      ? null
      : path.join(runtimeDir, "mysql", "mysqld.sock");
  const mysqlPort = site.services?.mysql?.ports?.MYSQL?.[0] || null;
  const wpRoot = site.wpRoot;

  await Promise.all([
    ensureReadableDirectory(site.absolutePath, "Local site path is not readable"),
    ensureReadableDirectory(wpRoot, "WordPress root is not readable"),
    ensureReadableDirectory(
      phpConfigDir,
      "Local PHP config directory is not readable",
    ),
    assertReadable(mysqlDefaultsFile, "Local MySQL config file is not readable"),
  ]);

  return {
    site,
    selectionMethod: site.selectionMethod,
    runtimeDir,
    wpRoot,
    database: site.mysql?.database || "local",
    phpConfigDir,
    mysqlDefaultsFile,
    mysqlSocket,
    mysqlPort,
    mysqlHost: config.platform === "win32" ? config.defaultMysqlHost : null,
    php,
    mysql,
    magickCoderModulePath: php.platformDirName
      ? path.join(
          php.packageDir,
          "bin",
          php.platformDirName,
          "ImageMagick",
          "modules-Q16",
          "coders",
        )
      : "",
  } satisfies SiteContext;
}

export async function resolveSite(selection: SiteSelection = {}) {
  const sites = await loadLocalSites();

  if (sites.length === 0) {
    throw new Error(
      `No LocalWP sites were found in ${config.localSitesJson}. Start by opening Local and creating or importing a site.`,
    );
  }

  const explicitSite = resolveExplicitSiteSelection(sites, selection);
  if (explicitSite) {
    return explicitSite;
  }

  const envSelection = resolveExplicitSiteSelection(sites, {
    siteId: process.env.LOCAL_SITE_ID,
    siteName: process.env.LOCAL_SITE_NAME,
  });
  if (envSelection) {
    return envSelection;
  }

  const cwdSelection = resolveCwdSiteSelection(sites);
  if (cwdSelection) {
    return cwdSelection;
  }

  const runningSites = sites.filter((site) => site.status === "running");
  if (runningSites.length === 1) {
    return { ...runningSites[0], selectionMethod: "single_running_site" };
  }

  if (sites.length === 1) {
    return { ...sites[0], selectionMethod: "single_site" };
  }

  throw new Error(
    "Could not safely choose a Local site. Pass 'siteName' or 'siteId' in the tool call, or set LOCAL_SITE_NAME / LOCAL_SITE_ID in the MCP config.",
  );
}

export function summarizeSite(site: LocalSite) {
  return {
    id: site.id,
    name: site.name,
    status: site.status,
    domain: site.domain,
    path: site.absolutePath,
    wpRoot: site.wpRoot,
    localVersion: site.localVersion,
    phpVersion: site.services?.php?.version || null,
    mysqlVersion: site.services?.mysql?.version || null,
    httpPort: site.services?.nginx?.ports?.HTTP?.[0] || null,
    mysqlPort: site.services?.mysql?.ports?.MYSQL?.[0] || null,
  };
}

export async function readJsonFile<T>(filePath: string, fallbackValue?: T) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read JSON file '${filePath}': ${message}`);
  }
}

export function expandHome(inputPath: string) {
  if (inputPath === "~") {
    return config.homeDir;
  }

  if (inputPath.startsWith("~/") || inputPath.startsWith("~\\")) {
    const relativePathParts = inputPath
      .slice(2)
      .split(/[\\/]+/)
      .filter(Boolean);

    return path.join(config.homeDir, ...relativePathParts);
  }

  return inputPath;
}

async function resolveServiceBinary(
  serviceName: string,
  serviceVersion: string | undefined,
  binaryName: string,
) {
  if (!serviceVersion) {
    throw new Error(`Missing ${serviceName} version in Local site metadata.`);
  }

  const executableCandidates = getExecutableCandidates(binaryName, config.platform);
  const servicePackage = await resolveServicePackageDir(serviceName, serviceVersion);

  if (servicePackage.layout === "lightning-services") {
    const binRoot = path.join(servicePackage.packageDir, "bin");
    const entries = await readdir(binRoot, { withFileTypes: true });
    const platformDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const preferredPlatformDirs = getPlatformBinDirCandidates(
      config.platform,
      config.arch,
    ).filter((directory) => platformDirs.includes(directory));
    const candidatePlatformDirs = [
      ...preferredPlatformDirs,
      ...platformDirs.filter((directory) => !preferredPlatformDirs.includes(directory)),
    ];

    for (const platformDirName of candidatePlatformDirs) {
      for (const executableName of executableCandidates) {
        const platformDirPath = path.join(binRoot, platformDirName);

        for (const binaryPath of getLightningServiceBinaryCandidates(
          platformDirPath,
          executableName,
          config.platform,
        )) {
          if (await isExecutablePath(binaryPath)) {
            return {
              packageDir: servicePackage.packageDir,
              platformDirName,
              binaryPath,
              layout: "lightning-services",
            } satisfies ServiceBinary;
          }
        }
      }
    }

    throw new Error(
      `Could not find executable '${binaryName}' for ${serviceName} in package '${servicePackage.packageDir}'.`,
    );
  }

  for (const executableName of executableCandidates) {
    const binaryPath = path.join(servicePackage.packageDir, "bin", executableName);

    if (await isExecutablePath(binaryPath)) {
      return {
        packageDir: servicePackage.packageDir,
        platformDirName: null,
        binaryPath,
        layout: "site-binaries",
      } satisfies ServiceBinary;
    }
  }

  throw new Error(
    `Could not find executable '${binaryName}' for ${serviceName} in package '${servicePackage.packageDir}'.`,
  );
}

async function resolveServicePackageDir(serviceName: string, serviceVersion: string) {
  const currentLayoutMatches = await collectMatchingDirectories(
    config.localLightningServicesDirs,
    `${serviceName}-${serviceVersion}+`,
  );

  if (currentLayoutMatches.length > 0) {
    return {
      packageDir: currentLayoutMatches[0],
      layout: "lightning-services" as const,
    };
  }

  const legacyLayoutMatches = await collectMatchingDirectories(
    getLegacySiteBinariesDirs(config.platform, config.localExtraResourcesDirs),
    `${serviceName}-${serviceVersion}`,
  );

  if (legacyLayoutMatches.length > 0) {
    return {
      packageDir: legacyLayoutMatches[0],
      layout: "site-binaries" as const,
    };
  }

  throw new Error(
    [
      `Could not find Local ${serviceName} service package for version ${serviceVersion}.`,
      `Checked lightning-services dirs: ${config.localLightningServicesDirs.join(", ")}`,
      `Checked legacy site-binaries dirs: ${getLegacySiteBinariesDirs(config.platform, config.localExtraResourcesDirs).join(", ")}`,
    ].join("\n"),
  );
}

function resolveExplicitSiteSelection(sites: LocalSite[], selection: SiteSelection) {
  const { siteId, siteName } = selection;

  if (siteId) {
    const match = sites.find((site) => site.id === siteId);

    if (!match) {
      throw new Error(`No Local site found for siteId '${siteId}'.`);
    }

    return { ...match, selectionMethod: "site_id" };
  }

  if (siteName) {
    const normalizedName = siteName.trim().toLowerCase();
    const matches = sites.filter(
      (site) => site.name.trim().toLowerCase() === normalizedName,
    );

    if (matches.length === 0) {
      throw new Error(`No Local site found for siteName '${siteName}'.`);
    }

    if (matches.length > 1) {
      throw new Error(
        `Multiple Local sites matched siteName '${siteName}'. Use siteId instead.`,
      );
    }

    return { ...matches[0], selectionMethod: "site_name" };
  }

  return null;
}

function resolveCwdSiteSelection(sites: LocalSite[]) {
  const cwd = process.cwd();
  const matchingSite = sites.find((site) => {
    const sitePath = site.absolutePath;
    return cwd === sitePath || cwd.startsWith(`${sitePath}${path.sep}`);
  });

  return matchingSite
    ? { ...matchingSite, selectionMethod: "cwd_match" }
    : null;
}

async function collectMatchingDirectories(directories: string[], prefix: string) {
  const matches: string[] = [];

  for (const directory of directories) {
    if (!(await isReadablePath(directory))) {
      continue;
    }

    const entries = await readdir(directory, { withFileTypes: true });

    matches.push(
      ...entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
        .map((entry) => path.join(directory, entry.name)),
    );
  }

  return matches.sort().reverse();
}
