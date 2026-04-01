import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { writeSiteFile } from "../site-files.js";
import { siteRelativePathSchema, siteSelectorSchema } from "../tool-schemas.js";

export function registerWriteSiteFileTool(server: McpServer) {
  server.registerTool(
    "write_site_file",
    {
      description:
        "Writes a text file inside the selected LocalWP site. Requires the 'full-access' profile.",
      inputSchema: {
        ...siteSelectorSchema,
        filePath: siteRelativePathSchema.describe(
          "File path relative to the selected site's root directory.",
        ),
        content: z.string().describe("Text content to write to the file."),
        createDirectories: z
          .boolean()
          .optional()
          .describe(
            "When true or omitted, create parent directories automatically.",
          ),
        overwrite: z
          .boolean()
          .optional()
          .describe(
            "When true or omitted, replace an existing file at the same path.",
          ),
      },
    },
    async ({
      siteId,
      siteName,
      filePath,
      content,
      createDirectories,
      overwrite,
    }) => {
      try {
        return createJsonToolResult(
          await writeSiteFile(
            { siteId, siteName },
            { filePath, content, createDirectories, overwrite },
          ),
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
