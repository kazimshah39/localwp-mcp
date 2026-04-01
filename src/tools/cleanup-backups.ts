import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  cleanupManagedBackups,
} from "../backup-management.js";
import { config } from "../config.js";
import { buildSiteContext } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerCleanupBackupsTool(server: McpServer) {
  server.registerTool(
    "cleanup_backups",
    {
      description:
        "Deletes managed backup artifacts for the selected LocalWP site based on age and/or retention. Requires the 'full-access' profile.",
      inputSchema: {
        ...siteSelectorSchema,
        rootPath: z
          .string()
          .optional()
          .describe(
            "Optional custom backup root directory to clean. If omitted, the site's managed localwp-mcp backup root is used.",
          ),
        categories: z
          .array(z.string())
          .optional()
          .describe(
            "Optional backup categories to target. Canonical values include full_backup, database_backup, pre_restore_backup, pre_import_backup, database_export, and sql_file. Friendly aliases like full, database, pre_restore, pre_import, managed_export, standalone_sql, and export are also accepted.",
          ),
        olderThanDays: z
          .number()
          .nonnegative()
          .optional()
          .describe(
            "Delete only artifacts older than this many days. Use 0 to target everything older than now.",
          ),
        keepLatest: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            "Keep this many newest matching artifacts and clean up older ones beyond that retention count.",
          ),
        dryRun: z
          .boolean()
          .optional()
          .describe(
            "When true, only report which artifacts would be deleted without deleting them.",
          ),
      },
    },
    async ({
      siteId,
      siteName,
      rootPath,
      categories,
      olderThanDays,
      keepLatest,
      dryRun,
    }) => {
      try {
        if (config.profile !== "full-access") {
          throw new Error(
            "cleanup_backups requires LOCALWP_MCP_PROFILE=full-access.",
          );
        }

        const context = await buildSiteContext({ siteId, siteName });
        return createJsonToolResult(
          await cleanupManagedBackups(context, {
            rootPath,
            categories,
            olderThanDays,
            keepLatest,
            dryRun,
          }),
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
