import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { readSiteFile } from "../site-files.js";
import { siteRelativePathSchema, siteSelectorSchema } from "../tool-schemas.js";

export function registerReadSiteFileTool(server: McpServer) {
  server.registerTool(
    "read_site_file",
    {
      description:
        "Reads a text file inside the selected LocalWP site. The path must stay inside that site's root directory.",
      inputSchema: {
        ...siteSelectorSchema,
        filePath: siteRelativePathSchema.describe(
          "File path relative to the selected site's root directory.",
        ),
        maxBytes: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of bytes to return from the file."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ siteId, siteName, filePath, maxBytes }) => {
      try {
        return createJsonToolResult(
          await readSiteFile({ siteId, siteName }, { filePath, maxBytes }),
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
