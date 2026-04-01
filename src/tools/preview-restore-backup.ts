import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { previewRestoreSiteBackup } from "../backup.js";
import { config } from "../config.js";
import { buildSiteContext, summarizeSite } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerPreviewRestoreBackupTool(server: McpServer) {
  server.registerTool(
    "preview_restore_backup",
    {
      description:
        "Previews how restore_backup would behave for a .sql file or backup directory without mutating the selected LocalWP site.",
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
            "When true or omitted, preview restoring app/conf/logs if the backup directory contains them.",
          ),
        replaceDirectories: z
          .boolean()
          .optional()
          .describe(
            "When true or omitted, preview full directory replacement before copying backup files.",
          ),
        backupBeforeRestore: z
          .boolean()
          .optional()
          .describe(
            "When true or omitted, preview creating a pre-restore backup automatically first.",
          ),
      },
      annotations: {
        readOnlyHint: true,
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
        const context = await buildSiteContext({ siteId, siteName });
        const result = await previewRestoreSiteBackup(context, sourcePath, {
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
