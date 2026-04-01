import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { runSiteLifecycleAction } from "../site-lifecycle.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerRestartLocalSiteTool(server: McpServer) {
  server.registerTool(
    "restart_local_site",
    {
      description:
        "Restarts the selected LocalWP site. If the site is halted, this starts it.",
      inputSchema: {
        ...siteSelectorSchema,
      },
    },
    async ({ siteId, siteName }) => {
      try {
        return createJsonToolResult(
          await runSiteLifecycleAction("restart", { siteId, siteName }),
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
