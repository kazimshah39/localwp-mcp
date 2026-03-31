import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { config } from "../config.js";
import { buildSiteContext, summarizeSite } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";
import { runWpCli } from "../wp-cli.js";

export function registerExecuteWpCliTool(server: McpServer) {
  server.registerTool(
    "execute_wp_cli",
    {
      description:
        "Runs a WP-CLI command against the selected LocalWP site using that site's Local PHP runtime and WordPress path.",
      inputSchema: {
        ...siteSelectorSchema,
        command: z
          .string()
          .min(1)
          .describe("WP-CLI arguments only, for example 'plugin list'."),
      },
    },
    async ({ siteId, siteName, command }) => {
      try {
        const context = await buildSiteContext({ siteId, siteName });
        const result = await runWpCli(context, command);

        return createJsonToolResult({
          site: summarizeSite(context.site),
          selectionMethod: context.selectionMethod,
          accessProfile: config.profile,
          command,
          ...result,
        });
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
