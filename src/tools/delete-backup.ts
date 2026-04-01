import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { deleteManagedBackup } from "../backup-management.js";
import { config } from "../config.js";
import { buildSiteContext } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerDeleteBackupTool(server: McpServer) {
  server.registerTool(
    "delete_backup",
    {
      description:
        "Deletes one managed backup artifact for the selected LocalWP site. Requires the 'full-access' profile.",
      inputSchema: {
        ...siteSelectorSchema,
        backupPath: z
          .string()
          .min(1)
          .describe(
            "Relative backup path from list_backups, for example 'woo-full-20260401-162738-restore-test' or 'pre-import/woo-before-import-20260401-120000.sql'.",
          ),
        rootPath: z
          .string()
          .optional()
          .describe(
            "Optional custom backup root directory if the artifact lives outside the default managed backup root.",
          ),
        missingOk: z
          .boolean()
          .optional()
          .describe(
            "When true, return success even if the requested artifact is already gone.",
          ),
      },
    },
    async ({ siteId, siteName, backupPath, rootPath, missingOk }) => {
      try {
        if (config.profile !== "full-access") {
          throw new Error("delete_backup requires LOCALWP_MCP_PROFILE=full-access.");
        }

        const context = await buildSiteContext({ siteId, siteName });
        return createJsonToolResult(
          await deleteManagedBackup(context, { backupPath, rootPath, missingOk }),
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
