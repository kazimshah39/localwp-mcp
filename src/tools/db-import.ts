import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { importDatabase } from "../backup.js";
import { config } from "../config.js";
import { buildSiteContext, summarizeSite } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerDbImportTool(server: McpServer) {
  server.registerTool(
    "db_import",
    {
      description:
        "Imports a SQL dump into the selected LocalWP site. You can pass either a .sql file path or a backup_site directory. Requires the 'full-access' profile.",
      inputSchema: {
        ...siteSelectorSchema,
        sourcePath: z
          .string()
          .min(1)
          .describe(
            "The source .sql file path or a backup_site directory that contains a manifest.json.",
          ),
        backupBeforeImport: z
          .boolean()
          .optional()
          .describe(
            "When true or omitted, export a pre-import SQL backup first.",
          ),
      },
    },
    async ({ siteId, siteName, sourcePath, backupBeforeImport }) => {
      try {
        if (config.profile !== "full-access") {
          throw new Error("db_import requires LOCALWP_MCP_PROFILE=full-access.");
        }

        const context = await buildSiteContext({ siteId, siteName });
        const result = await importDatabase(context, sourcePath, {
          backupBeforeImport,
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
