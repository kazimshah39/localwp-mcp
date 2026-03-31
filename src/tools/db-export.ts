import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { exportDatabase } from "../backup.js";
import { config } from "../config.js";
import { buildSiteContext, summarizeSite } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerDbExportTool(server: McpServer) {
  server.registerTool(
    "db_export",
    {
      description:
        "Exports the selected LocalWP site's database to a SQL file. The destination can be a .sql file path or a directory.",
      inputSchema: {
        ...siteSelectorSchema,
        destinationPath: z
          .string()
          .optional()
          .describe(
            "Optional destination .sql file path or directory. If omitted, the export is written to localwp-mcp-backups/database-exports.",
          ),
        label: z
          .string()
          .optional()
          .describe("Optional label to include in the exported SQL filename."),
      },
    },
    async ({ siteId, siteName, destinationPath, label }) => {
      try {
        const context = await buildSiteContext({ siteId, siteName });
        const result = await exportDatabase(context, {
          destinationPath,
          label,
        });

        return createJsonToolResult({
          site: summarizeSite(context.site),
          selectionMethod: context.selectionMethod,
          accessProfile: config.profile,
          ...result,
        });
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
