import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { runSiteLifecycleAction } from "../site-lifecycle.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerStartLocalSiteTool(server: McpServer) {
  server.registerTool(
    "start_local_site",
    {
      description:
        "Starts the selected LocalWP site and all of its services.",
      inputSchema: {
        ...siteSelectorSchema,
      },
    },
    async ({ siteId, siteName }) => {
      try {
        return createJsonToolResult(
          await runSiteLifecycleAction("start", { siteId, siteName }),
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
