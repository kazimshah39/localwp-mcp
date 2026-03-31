import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runEnvironmentCheck } from "../environment-check.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerLocalEnvironmentCheckTool(server: McpServer) {
  server.registerTool(
    "local_environment_check",
    {
      description:
        "Runs a non-destructive LocalWP environment self-check for this machine, including resolved Local paths and optional WP-CLI/MySQL probes for one site.",
      inputSchema: {
        ...siteSelectorSchema,
        probeWpCli: z
          .boolean()
          .optional()
          .describe("When true, run a lightweight 'wp core is-installed' probe."),
        probeMysql: z
          .boolean()
          .optional()
          .describe("When true, run a lightweight 'SELECT 1 AS ok' MySQL probe."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ siteId, siteName, probeWpCli, probeMysql }) => {
      try {
        const result = await runEnvironmentCheck(
          { siteId, siteName },
          { probeWpCli, probeMysql },
        );

        return createJsonToolResult(result);
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
