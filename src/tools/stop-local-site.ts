import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { runSiteLifecycleAction } from "../site-lifecycle.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerStopLocalSiteTool(server: McpServer) {
  server.registerTool(
    "stop_local_site",
    {
      description:
        "Stops the selected LocalWP site and all of its services.",
      inputSchema: {
        ...siteSelectorSchema,
      },
    },
    async ({ siteId, siteName }) => {
      try {
        return createJsonToolResult(
          await runSiteLifecycleAction("stop", { siteId, siteName }),
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
