import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { config } from "../config.js";
import { buildSiteContext, summarizeSite } from "../local-sites.js";
import { describeMysqlExecution } from "../mysql.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";
import { resolveWpCliExecution } from "../wp-cli.js";

export function registerLocalSiteInfoTool(server: McpServer) {
  server.registerTool(
    "local_site_info",
    {
      description:
        "Resolves one LocalWP site and returns its WordPress, PHP, and MySQL runtime details.",
      inputSchema: {
        ...siteSelectorSchema,
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ siteId, siteName }) => {
      try {
        const context = await buildSiteContext({ siteId, siteName });
        const wpCliExecution = await resolveWpCliExecution(context);
        const mysqlExecution = describeMysqlExecution(context);

        return createJsonToolResult({
          site: summarizeSite(context.site),
          platform: config.platform,
          arch: config.arch,
          wpRoot: context.wpRoot,
          runtimeDir: context.runtimeDir,
          wordpressPath: context.wpRoot,
          localAppSupportDir: config.localAppSupportDir,
          localExtraResourcesDirs: config.localExtraResourcesDirs,
          localLightningServicesDirs: config.localLightningServicesDirs,
          mysqlDefaultsFile: context.mysqlDefaultsFile,
          mysqlHost: context.mysqlHost,
          mysqlPort: context.mysqlPort,
          mysqlSocket: context.mysqlSocket,
          mysqlBinary: context.mysql.binaryPath,
          phpBinary: context.php.binaryPath,
          wpCliPhar: wpCliExecution.tooling.wpCliPhar,
          wpCliConfig: wpCliExecution.tooling.wpCliConfig,
          wpCliRuntime: {
            command: wpCliExecution.command,
            argsPrefix: wpCliExecution.argsPrefix,
            cwd: wpCliExecution.cwd,
            envOverrides: {
              PHPRC: context.phpConfigDir,
              WP_CLI_DISABLE_AUTO_CHECK_UPDATE: "1",
              WP_CLI_CONFIG_PATH: wpCliExecution.tooling.wpCliConfig,
              PATHPrefixEntries: wpCliExecution.pathEntries,
              MAGICK_CODER_MODULE_PATH: context.magickCoderModulePath || null,
            },
            note:
              "MCP invokes WP-CLI through the Local-managed PHP runtime. Plain shell 'wp' may fail if it does not use the same PHP binary, PHPRC, config, and socket-aware Local context.",
          },
          mysqlRuntime: {
            command: mysqlExecution.command,
            argsPrefix: mysqlExecution.argsPrefix,
            database: mysqlExecution.database,
            cwd: mysqlExecution.cwd,
          },
          shellReproduction: {
            wpCli: {
              env: {
                PHPRC: context.phpConfigDir,
                WP_CLI_DISABLE_AUTO_CHECK_UPDATE: "1",
                WP_CLI_CONFIG_PATH: wpCliExecution.tooling.wpCliConfig,
              },
              command: [
                wpCliExecution.command,
                ...wpCliExecution.argsPrefix,
              ],
              cwd: wpCliExecution.cwd,
            },
            mysql: {
              command: [
                mysqlExecution.command,
                ...mysqlExecution.argsPrefix,
                mysqlExecution.database,
              ],
              cwd: mysqlExecution.cwd,
            },
          },
          selectionMethod: context.selectionMethod,
          accessProfile: config.profile,
        });
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
