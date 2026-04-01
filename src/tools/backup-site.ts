import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createSiteBackup } from "../backup.js";
import { config } from "../config.js";
import { buildSiteContext, summarizeSite } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { backupScopeSchema, siteSelectorSchema } from "../tool-schemas.js";

export function registerBackupSiteTool(server: McpServer) {
  server.registerTool(
    "backup_site",
    {
      description:
        "Creates a Local-friendly backup for the selected site. Use scope='database' for a SQL-only backup or scope='full' for app/conf/logs plus a fresh SQL export.",
      inputSchema: {
        ...siteSelectorSchema,
        scope: backupScopeSchema,
        outputDir: z
          .string()
          .optional()
          .describe(
            "Optional output directory. If omitted, backups are written to the site's localwp-mcp-backups folder.",
          ),
        label: z
          .string()
          .optional()
          .describe("Optional short label to include in the backup folder name."),
      },
    },
    async ({ siteId, siteName, scope, outputDir, label }) => {
      try {
        const context = await buildSiteContext({ siteId, siteName });
        const result = await createSiteBackup(context, {
          scope,
          outputDir,
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
