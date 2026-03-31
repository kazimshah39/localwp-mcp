import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { searchSiteFiles } from "../site-files.js";
import { siteRelativePathSchema, siteSelectorSchema } from "../tool-schemas.js";

export function registerSearchSiteFilesTool(server: McpServer) {
  server.registerTool(
    "search_site_files",
    {
      description:
        "Searches text files inside the selected LocalWP site for a literal string match.",
      inputSchema: {
        ...siteSelectorSchema,
        query: z
          .string()
          .min(1)
          .describe("Literal text to search for inside site files."),
        directoryPath: siteRelativePathSchema
          .optional()
          .describe(
            "Optional directory path relative to the selected site's root. Defaults to the site root.",
          ),
        caseSensitive: z
          .boolean()
          .optional()
          .describe("When true, search with exact case."),
        includeHidden: z
          .boolean()
          .optional()
          .describe("When true, include dotfiles and hidden directories."),
        maxDepth: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Maximum directory depth to search."),
        maxMatches: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of matches to return."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({
      siteId,
      siteName,
      query,
      directoryPath,
      caseSensitive,
      includeHidden,
      maxDepth,
      maxMatches,
    }) => {
      try {
        return createJsonToolResult(
          await searchSiteFiles(
            { siteId, siteName },
            {
              query,
              directoryPath,
              caseSensitive,
              includeHidden,
              maxDepth,
              maxMatches,
            },
          ),
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
