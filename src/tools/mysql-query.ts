import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  buildSiteContext,
  summarizeSite,
} from "../local-sites.js";
import {
  clampMaxRows,
  executeMysqlStatement,
  ensureMysqlReady,
  validateSafeSqlQuery,
} from "../mysql.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerMysqlQueryTool(server: McpServer) {
  server.registerTool(
    "mysql_query",
    {
      description:
        "Runs a SQL query against the selected LocalWP site's MySQL database in the 'safe' profile. Only SELECT, SHOW, DESCRIBE, DESC, and EXPLAIN are allowed.",
      inputSchema: {
        ...siteSelectorSchema,
        sql: z
          .string()
          .min(1)
          .describe("A single SQL statement allowed by the 'safe' profile."),
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
    async ({ siteId, siteName, sql, maxRows }) => {
      try {
        const context = await buildSiteContext({ siteId, siteName });
        await ensureMysqlReady(context);

        const safeSql = validateSafeSqlQuery(sql);
        const result = await executeMysqlStatement(
          context,
          safeSql,
          clampMaxRows(maxRows),
        );

        return createJsonToolResult({
          site: summarizeSite(context.site),
          selectionMethod: context.selectionMethod,
          sql: safeSql,
          ...result,
        });
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
