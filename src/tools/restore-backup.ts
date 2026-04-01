import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { restoreSiteBackup } from "../backup.js";
import { config } from "../config.js";
import { buildSiteContext, summarizeSite } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerRestoreBackupTool(server: McpServer) {
  server.registerTool(
    "restore_backup",
    {
      description:
        "Restores a LocalWP site from a .sql file or a backup_site directory. In full-access mode it can restore the database and, when available, the backup's app/conf/logs directories.",
      inputSchema: {
        ...siteSelectorSchema,
        sourcePath: z
          .string()
          .min(1)
          .describe(
            "Path to a .sql file or a backup_site directory containing manifest.json.",
          ),
        restoreFiles: z
          .boolean()
          .optional()
          .describe(
            "When true or omitted, also restore app/conf/logs if the backup directory contains them.",
          ),
        replaceDirectories: z
          .boolean()
          .optional()
          .describe(
            "When true or omitted, replace the target app/conf/logs directories before copying the backup versions.",
          ),
        backupBeforeRestore: z
          .boolean()
          .optional()
          .describe(
            "When true or omitted, create a pre-restore backup automatically first.",
          ),
      },
    },
    async ({
      siteId,
      siteName,
      sourcePath,
      restoreFiles,
      replaceDirectories,
      backupBeforeRestore,
    }) => {
      try {
        if (config.profile !== "full-access") {
          throw new Error(
            "restore_backup requires LOCALWP_MCP_PROFILE=full-access.",
          );
        }

        const context = await buildSiteContext({ siteId, siteName });
        const result = await restoreSiteBackup(context, sourcePath, {
          restoreFiles,
          replaceDirectories,
          backupBeforeRestore,
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
