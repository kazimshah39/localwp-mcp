import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { config } from "../config.js";
import { resolveLocalTooling } from "../local-tooling.js";
import { buildSiteContext, summarizeSite } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

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
        const tooling = await resolveLocalTooling();

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
          wpCliPhar: tooling.wpCliPhar,
          wpCliConfig: tooling.wpCliConfig,
          selectionMethod: context.selectionMethod,
          accessProfile: config.profile,
        });
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
