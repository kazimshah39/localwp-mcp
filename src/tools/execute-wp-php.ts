import { rm } from "fs/promises";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { config } from "../config.js";
import { StructuredToolError } from "../errors.js";
import { buildSiteContext, summarizeSite } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";
import { runWpCliArgs } from "../wp-cli.js";
import { prepareWpPhpSource } from "../wp-runtime.js";

export function registerExecuteWpPhpTool(server: McpServer) {
  server.registerTool(
    "execute_wp_php",
    {
      description:
        "Runs a high-trust PHP snippet or PHP file inside the selected LocalWP site's loaded WordPress runtime using a file-based eval flow. Requires the 'full-access' profile.",
      inputSchema: {
        ...siteSelectorSchema,
        phpCode: z
          .string()
          .optional()
          .describe(
            "Optional inline PHP to run after WordPress loads. If you omit '<?php', the tool will prepend it for you.",
          ),
        filePath: z
          .string()
          .optional()
          .describe(
            "Optional absolute path or working-directory-relative path to a readable .php file inside the current workspace or selected Local site.",
          ),
      },
    },
    async ({ siteId, siteName, phpCode, filePath }) => {
      try {
        if (config.profile !== "full-access") {
          throw new StructuredToolError({
            error: "profile_required",
            message:
              "execute_wp_php requires LOCALWP_MCP_PROFILE=full-access because it executes PHP inside the loaded WordPress runtime.",
            requiredProfile: "full-access",
            accessProfile: config.profile,
          });
        }

        const context = await buildSiteContext({ siteId, siteName });
        const source = await prepareWpPhpSource({
          siteRoot: context.site.absolutePath,
          phpCode,
          filePath,
        });

        try {
          const result = await runWpCliArgs(
            context,
            ["eval-file", source.absolutePath],
            {
              skipPermissionCheck: true,
            },
          );

          return createJsonToolResult({
            site: summarizeSite(context.site),
            selectionMethod: context.selectionMethod,
            accessProfile: config.profile,
            executionEngine: "wp eval-file",
            sourceMode: source.mode,
            sourcePath: source.sourcePath,
            stdout: result.stdout,
            stderr: result.stderr,
          });
        } finally {
          if (source.cleanupPath) {
            await rm(source.cleanupPath, {
              recursive: true,
              force: true,
            });
          }
        }
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
