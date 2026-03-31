import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { loadLocalSites, summarizeSite } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";

export function registerListLocalSitesTool(server: McpServer) {
  server.registerTool(
    "list_local_sites",
    {
      description:
        "Lists LocalWP sites from Local's own metadata, including status, path, domain, and service versions.",
      inputSchema: {
        includeStopped: z
          .boolean()
          .optional()
          .describe("When true, include halted sites. Defaults to true."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ includeStopped }) => {
      try {
        const sites = await loadLocalSites();
        const filteredSites =
          includeStopped === false
            ? sites.filter((site) => site.status === "running")
            : sites;

        return createJsonToolResult({
          sites: filteredSites.map((site) => summarizeSite(site)),
          count: filteredSites.length,
        });
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
