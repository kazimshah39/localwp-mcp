import { rm } from "fs/promises";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { config } from "../config.js";
import { buildSiteContext, summarizeSite } from "../local-sites.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";
import type { SiteContext, SpawnResult } from "../types.js";
import {
  assertWpCliProcessSucceeded,
  formatWpCliProcessError,
  runWpCliArgsRaw,
} from "../wp-cli.js";
import {
  describeReadOnlyRuntimeOutcome,
  extractWpReadonlyPhpPayload,
  prepareReadonlyWpPhpExecutionFiles,
  resolveReadOnlyRuntimeResult,
} from "../wp-runtime.js";

export function registerExecuteWpPhpReadonlyTool(server: McpServer) {
  server.registerTool(
    "execute_wp_php_readonly",
    {
      description:
        "Runs a best-effort read-only PHP snippet or PHP file inside the selected LocalWP site's loaded WordPress runtime using file-based execution plus SQL, HTTP, and mail guardrails.",
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
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ siteId, siteName, phpCode, filePath }) => {
      try {
        const context = await buildSiteContext({ siteId, siteName });
        const files = await prepareReadonlyWpPhpExecutionFiles({
          siteRoot: context.site.absolutePath,
          phpCode,
          filePath,
        });

        try {
          const result = await runWpCliArgsRaw(context, [
            `--require=${files.guardPath}`,
            "eval-file",
            files.scriptPath,
          ]);
          const { parsed, wpCliStatus, wpCliWarning } =
            resolveReadonlyPhpProcessResult(context, result);
          const semanticResult = resolveReadOnlyRuntimeResult({
            rawResultType: parsed.payload.rawResultType,
            rawResult: parsed.payload.rawResult,
            readOnlyState: parsed.payload.readOnlyState,
          });
          const readOnlyOutcome = describeReadOnlyRuntimeOutcome(
            parsed.payload.readOnlyState,
          );

          return createJsonToolResult({
            site: summarizeSite(context.site),
            selectionMethod: context.selectionMethod,
            accessProfile: config.profile,
            inspectionMode: "best-effort-read-only",
            executionEngine: "wp eval-file with read-only guard",
            sourceMode: files.sourceMode,
            sourcePath: files.sourcePath,
            outcome: semanticResult.outcome,
            resultType: semanticResult.resultType,
            result: semanticResult.result,
            rawResultType: parsed.payload.rawResultType,
            rawResult: parsed.payload.rawResult,
            stdout: parsed.payload.stdout || null,
            remainingStdout: parsed.remainingStdout || null,
            readOnlyState: readOnlyOutcome.readOnlyState,
            stderr: result.stderr || null,
            wpCliExitCode: result.exitCode,
            wpCliStatus,
            wpCliWarning,
            caveats: [
              "This tool is designed for inspection and adds best-effort read-only guardrails.",
              "It blocks common SQL writes on the main WordPress database connection plus outgoing HTTP and email.",
              "It is not a full PHP sandbox, so custom side effects outside those paths are still theoretically possible.",
            ],
          });
        } finally {
          for (const cleanupPath of files.cleanupPaths) {
            await rm(cleanupPath, {
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

function resolveReadonlyPhpProcessResult(
  context: Pick<SiteContext, "site">,
  result: Pick<SpawnResult, "stdout" | "stderr" | "exitCode" | "timedOut">,
) {
  let parsed:
    | ReturnType<typeof extractWpReadonlyPhpPayload>
    | null = null;

  try {
    parsed = extractWpReadonlyPhpPayload(result.stdout);
  } catch {
    parsed = null;
  }

  if (!parsed) {
    assertWpCliProcessSucceeded(context as SiteContext, result as SpawnResult);
    parsed = extractWpReadonlyPhpPayload(result.stdout);
  }

  return {
    parsed,
    wpCliStatus:
      result.exitCode === 0 ? "ok" : "payload_recovered_from_nonzero_exit",
    wpCliWarning:
      result.exitCode === 0
        ? null
        : formatWpCliProcessError(context as SiteContext, result as SpawnResult),
  } as const;
}
