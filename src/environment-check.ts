import { config } from "./config.js";
import { buildSiteContext, loadLocalSites, summarizeSite } from "./local-sites.js";
import { resolveLocalTooling } from "./local-tooling.js";
import { ensureMysqlReady, executeMysqlStatement } from "./mysql.js";
import { formatError } from "./results.js";
import { isExecutablePath, isReadablePath } from "./process-utils.js";
import { runWpCli } from "./wp-cli.js";
import type { SiteSelection } from "./types.js";

export async function runEnvironmentCheck(
  selection: SiteSelection,
  options: {
    probeWpCli?: boolean;
    probeMysql?: boolean;
  } = {},
) {
  const { probeWpCli = false, probeMysql = false } = options;
  const directoryChecks = await Promise.all([
    describePath(config.localAppSupportDir, "directory"),
    describePath(config.localRunDir, "directory"),
    describePath(config.localSitesJson, "file"),
    describePath(config.localSiteStatusesJson, "file"),
  ]);
  const extraResourcesChecks = await Promise.all(
    config.localExtraResourcesDirs.map((candidate) =>
      describePath(candidate, "directory"),
    ),
  );
  const lightningServicesChecks = await Promise.all(
    config.localLightningServicesDirs.map((candidate) =>
      describePath(candidate, "directory"),
    ),
  );

  const sitesSummary = await describeLocalSites();
  const toolingSummary = await describeLocalTooling();
  const siteSummary = await describeSiteContext(selection, {
    probeWpCli,
    probeMysql,
  });

  return {
    platform: config.platform,
    arch: config.arch,
    nodeVersion: process.version,
    accessProfile: config.profile,
    requestedSiteId: selection.siteId || null,
    requestedSiteName: selection.siteName || null,
    probes: {
      wpCli: probeWpCli,
      mysql: probeMysql,
    },
    corePaths: {
      localAppSupportDir: directoryChecks[0],
      localRunDir: directoryChecks[1],
      localSitesJson: directoryChecks[2],
      localSiteStatusesJson: directoryChecks[3],
      localExtraResourcesDirs: extraResourcesChecks,
      localLightningServicesDirs: lightningServicesChecks,
    },
    tooling: toolingSummary,
    sites: sitesSummary,
    siteContext: siteSummary,
  };
}

async function describeLocalSites() {
  try {
    const sites = await loadLocalSites();

    return {
      ok: true,
      count: sites.length,
      runningCount: sites.filter((site) => site.status === "running").length,
      sites: sites.map((site) => summarizeSite(site)),
    };
  } catch (error) {
    return {
      ok: false,
      error: formatError(error),
    };
  }
}

async function describeLocalTooling() {
  try {
    const tooling = await resolveLocalTooling();

    return {
      ok: true,
      wpCliPhar: await describePath(tooling.wpCliPhar, "file", true),
      wpCliConfig: tooling.wpCliConfig
        ? await describePath(tooling.wpCliConfig, "file")
        : null,
      helperBinDirs: await Promise.all(
        tooling.helperBinDirs.map((candidate) =>
          describePath(candidate, "directory"),
        ),
      ),
    };
  } catch (error) {
    return {
      ok: false,
      error: formatError(error),
      candidates: {
        wpCliPhar: config.localWpCliPharCandidates,
        wpCliConfig: config.localWpCliConfigCandidates,
        helperBinDirs: config.localHelperBinDirCandidates,
      },
    };
  }
}

async function describeSiteContext(
  selection: SiteSelection,
  options: {
    probeWpCli: boolean;
    probeMysql: boolean;
  },
) {
  try {
    const context = await buildSiteContext(selection);
    const siteContext = {
      ok: true,
      selectionMethod: context.selectionMethod || null,
      site: summarizeSite(context.site),
      runtimeDir: await describePath(context.runtimeDir, "directory"),
      wpRoot: await describePath(context.wpRoot, "directory"),
      phpConfigDir: await describePath(context.phpConfigDir, "directory"),
      mysqlDefaultsFile: await describePath(context.mysqlDefaultsFile, "file"),
      phpBinary: await describePath(context.php.binaryPath, "file", true),
      mysqlBinary: await describePath(context.mysql.binaryPath, "file", true),
      mysqlConnection: context.mysqlSocket
        ? {
            mode: "socket",
            socket: await describePath(context.mysqlSocket, "file"),
            port: context.mysqlPort,
            host: context.mysqlHost,
          }
        : {
            mode: "tcp",
            socket: null,
            port: context.mysqlPort,
            host: context.mysqlHost,
          },
      wpCliProbe: null as null | Record<string, unknown>,
      mysqlProbe: null as null | Record<string, unknown>,
    };

    if (options.probeWpCli) {
      try {
        const result = await runWpCli(context, "core is-installed");
        siteContext.wpCliProbe = {
          ok: true,
          command: "core is-installed",
          stdout: result.stdout,
          stderr: result.stderr || null,
        };
      } catch (error) {
        siteContext.wpCliProbe = {
          ok: false,
          command: "core is-installed",
          error: formatError(error),
        };
      }
    }

    if (options.probeMysql) {
      try {
        await ensureMysqlReady(context);
        const result = await executeMysqlStatement(context, "SELECT 1 AS ok", 1);
        siteContext.mysqlProbe = {
          ok: true,
          sql: "SELECT 1 AS ok",
          rows: result.rows,
          stderr: result.stderr,
        };
      } catch (error) {
        siteContext.mysqlProbe = {
          ok: false,
          sql: "SELECT 1 AS ok",
          error: formatError(error),
        };
      }
    }

    return siteContext;
  } catch (error) {
    return {
      ok: false,
      error: formatError(error),
    };
  }
}

async function describePath(
  candidatePath: string,
  kind: "file" | "directory",
  executable = false,
) {
  const readable = await isReadablePath(candidatePath);
  const executableFlag = executable ? await isExecutablePath(candidatePath) : null;

  return {
    path: candidatePath,
    kind,
    readable,
    executable: executableFlag,
  };
}
