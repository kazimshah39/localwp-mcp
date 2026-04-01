import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { buildSiteContext, summarizeSite } from "../local-sites.js";
import {
  buildDescribeTableSql,
  buildListTablesSql,
  clampMaxRows,
  executeMysqlStatement,
  ensureMysqlReady,
} from "../mysql.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerMysqlSchemaTool(server: McpServer) {
  server.registerTool(
    "mysql_schema",
    {
      description:
        "Returns table or column metadata for the selected LocalWP site's database without needing free-form SQL.",
      inputSchema: {
        ...siteSelectorSchema,
        table: z
          .string()
          .optional()
          .describe(
            "Optional table name. If omitted, the tool lists tables in the site's database.",
          ),
        tableName: z
          .string()
          .optional()
          .describe(
            "Backward-compatible alias for 'table'. If provided, it is treated the same way.",
          ),
        maxRows: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum rows to return to the client."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ siteId, siteName, table, tableName, maxRows }) => {
      try {
        const context = await buildSiteContext({ siteId, siteName });
        await ensureMysqlReady(context);
        const selectedTable = table || tableName;

        const sql = selectedTable
          ? buildDescribeTableSql(context.database, selectedTable)
          : buildListTablesSql(context.database);
        const result = await executeMysqlStatement(
          context,
          sql,
          clampMaxRows(maxRows),
        );

        return createJsonToolResult({
          site: summarizeSite(context.site),
          selectionMethod: context.selectionMethod,
          table: selectedTable || null,
          ...result,
        });
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
