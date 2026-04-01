import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { deleteSiteFile } from "../site-files.js";
import { siteRelativePathSchema, siteSelectorSchema } from "../tool-schemas.js";

export function registerDeleteSiteFileTool(server: McpServer) {
  server.registerTool(
    "delete_site_file",
    {
      description:
        "Deletes a file or directory inside the selected LocalWP site. Requires the 'full-access' profile.",
      inputSchema: {
        ...siteSelectorSchema,
        targetPath: siteRelativePathSchema.describe(
          "File or directory path relative to the selected site's root directory.",
        ),
        recursive: z
          .boolean()
          .optional()
          .describe(
            "When true, allow deleting non-empty directories recursively.",
          ),
        missingOk: z
          .boolean()
          .optional()
          .describe(
            "When true, return success even if the target path does not exist.",
          ),
      },
    },
    async ({ siteId, siteName, targetPath, recursive, missingOk }) => {
      try {
        return createJsonToolResult(
          await deleteSiteFile(
            { siteId, siteName },
            { targetPath, recursive, missingOk },
          ),
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
