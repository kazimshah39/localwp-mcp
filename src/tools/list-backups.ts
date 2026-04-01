import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { listManagedBackups } from "../backup-management.js";
import { buildSiteContext } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerListBackupsTool(server: McpServer) {
  server.registerTool(
    "list_backups",
    {
      description:
        "Lists backup directories and SQL export artifacts managed for the selected LocalWP site.",
      inputSchema: {
        ...siteSelectorSchema,
        rootPath: z
          .string()
          .optional()
          .describe(
            "Optional custom backup root directory to inspect. If omitted, the site's managed localwp-mcp backup root is used.",
          ),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ siteId, siteName, rootPath }) => {
      try {
        const context = await buildSiteContext({ siteId, siteName });
        return createJsonToolResult(
          await listManagedBackups(context, { rootPath }),
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
