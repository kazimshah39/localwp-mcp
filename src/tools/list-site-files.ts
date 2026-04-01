import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { listSiteFiles } from "../site-files.js";
import { siteRelativePathSchema, siteSelectorSchema } from "../tool-schemas.js";

export function registerListSiteFilesTool(server: McpServer) {
  server.registerTool(
    "list_site_files",
    {
      description:
        "Lists files and directories inside the selected LocalWP site. Paths are scoped to that site's root directory.",
      inputSchema: {
        ...siteSelectorSchema,
        directoryPath: siteRelativePathSchema
          .optional()
          .describe(
            "Optional directory path relative to the selected site's root. Defaults to the site root.",
          ),
        recursive: z
          .boolean()
          .optional()
          .describe("When true, walk child directories recursively."),
        maxDepth: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Maximum recursion depth when recursive=true."),
        maxEntries: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of entries to return."),
        includeHidden: z
          .boolean()
          .optional()
          .describe("When true, include dotfiles and hidden directories."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({
      siteId,
      siteName,
      directoryPath,
      recursive,
      maxDepth,
      maxEntries,
      includeHidden,
    }) => {
      try {
        return createJsonToolResult(
          await listSiteFiles(
            { siteId, siteName },
            { directoryPath, recursive, maxDepth, maxEntries, includeHidden },
          ),
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
