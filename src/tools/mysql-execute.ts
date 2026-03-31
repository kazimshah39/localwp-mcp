import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { config } from "../config.js";
import { buildSiteContext, summarizeSite } from "../local-sites.js";
import {
  clampMaxRows,
  executeMysqlStatement,
  ensureMysqlReady,
  getSqlVerb,
  validateFullAccessSql,
} from "../mysql.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerMysqlExecuteTool(server: McpServer) {
  server.registerTool(
    "mysql_execute",
    {
      description:
        "Runs any single SQL statement against the selected LocalWP site's MySQL database in the 'full-access' profile.",
      inputSchema: {
        ...siteSelectorSchema,
        sql: z
          .string()
          .min(1)
          .describe("A single SQL statement to execute."),
        maxRows: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum rows to return if the statement yields a result set."),
      },
    },
    async ({ siteId, siteName, sql, maxRows }) => {
      try {
        if (config.profile !== "full-access") {
          throw new Error(
            "mysql_execute requires LOCALWP_MCP_PROFILE=full-access.",
          );
        }

        const context = await buildSiteContext({ siteId, siteName });
        await ensureMysqlReady(context);

        const executableSql = validateFullAccessSql(sql);
        const result = await executeMysqlStatement(
          context,
          executableSql,
          clampMaxRows(maxRows),
        );

        return createJsonToolResult({
          site: summarizeSite(context.site),
          selectionMethod: context.selectionMethod,
          accessProfile: config.profile,
          sql: executableSql,
          statementType: getSqlVerb(executableSql),
          ...result,
        });
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
