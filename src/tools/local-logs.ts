import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { collectLocalLogs } from "../logs.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { logScopeSchema, siteSelectorSchema } from "../tool-schemas.js";

export function registerLocalLogsTool(server: McpServer) {
  server.registerTool(
    "local_logs",
    {
      description:
        "Reads recent Local site logs and Local app logs, including WordPress debug.log, PHP, nginx, and Local's own verbose logs.",
      inputSchema: {
        ...siteSelectorSchema,
        scope: logScopeSchema,
        lines: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("How many lines to read from the end of each log file."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ siteId, siteName, scope, lines }) => {
      try {
        const result = await collectLocalLogs(
          { siteId, siteName },
          { scope, lines },
        );

        return createJsonToolResult(result);
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
