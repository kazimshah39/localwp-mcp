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
  extractWpRuntimeCallPayload,
  parseWpRuntimeArgsJson,
  prepareWpRuntimeCallFiles,
  resolveReadOnlyRuntimeResult,
} from "../wp-runtime.js";

export function registerWpRuntimeCallTools(server: McpServer) {
  registerWpCallFunctionTool(server);
  registerWpCallStaticMethodTool(server);
}

export function resolveWpRuntimeCallProcessResult(
  context: Pick<SiteContext, "site">,
  result: Pick<SpawnResult, "stdout" | "stderr" | "exitCode" | "timedOut">,
) {
  let parsed:
    | ReturnType<typeof extractWpRuntimeCallPayload>
    | null = null;

  try {
    parsed = extractWpRuntimeCallPayload(result.stdout);
  } catch {
    parsed = null;
  }

  if (!parsed) {
    assertWpCliProcessSucceeded(context as SiteContext, result as SpawnResult);
    parsed = extractWpRuntimeCallPayload(result.stdout);
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

function registerWpCallFunctionTool(server: McpServer) {
  server.registerTool(
    "wp_call_function",
    {
      description:
        "Runs a read-oriented function call inside the selected LocalWP site's loaded WordPress runtime using explicit JSON arguments and best-effort read-only guardrails.",
      inputSchema: {
        ...siteSelectorSchema,
        functionName: z
          .string()
          .min(1)
          .describe(
            "Function name to call inside the loaded WordPress runtime, for example 'wp_get_theme' or 'MyNamespace\\\\debug_helper'.",
          ),
        argsJson: z
          .string()
          .optional()
          .describe(
            "Optional JSON array of positional arguments to pass to the function.",
          ),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ siteId, siteName, functionName, argsJson }) => {
      try {
        return await executeReadOnlyRuntimeCall(
          { siteId, siteName },
          {
            callType: "function",
            functionName,
            args: parseWpRuntimeArgsJson(argsJson),
          },
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}

function registerWpCallStaticMethodTool(server: McpServer) {
  server.registerTool(
    "wp_call_static_method",
    {
      description:
        "Runs a read-oriented static method call inside the selected LocalWP site's loaded WordPress runtime using explicit JSON arguments and best-effort read-only guardrails.",
      inputSchema: {
        ...siteSelectorSchema,
        className: z
          .string()
          .min(1)
          .describe(
            "Class name to call, for example 'WebhookService' or 'Vendor\\\\Plugin\\\\WebhookService'.",
          ),
        methodName: z
          .string()
          .min(1)
          .describe("Static method name to call."),
        argsJson: z
          .string()
          .optional()
          .describe(
            "Optional JSON array of positional arguments to pass to the static method.",
          ),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ siteId, siteName, className, methodName, argsJson }) => {
      try {
        return await executeReadOnlyRuntimeCall(
          { siteId, siteName },
          {
            callType: "static_method",
            className,
            methodName,
            args: parseWpRuntimeArgsJson(argsJson),
          },
        );
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}

async function executeReadOnlyRuntimeCall(
  selection: {
    siteId?: string;
    siteName?: string;
  },
  options:
    | {
        callType: "function";
        functionName: string;
        args: unknown[];
      }
    | {
        callType: "static_method";
        className: string;
        methodName: string;
        args: unknown[];
      },
) {
  const context = await buildSiteContext(selection);
  const files = await prepareWpRuntimeCallFiles(options);

  try {
    const result = await runWpCliArgsRaw(
      context,
      [`--require=${files.guardPath}`, "eval-file", files.scriptPath],
    );
    const { parsed, wpCliStatus, wpCliWarning } =
      resolveWpRuntimeCallProcessResult(context, result);
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
      callType: parsed.payload.callType,
      callable: parsed.payload.callable,
      args: parsed.payload.args,
      outcome: semanticResult.outcome,
      resultType: semanticResult.resultType,
      result: semanticResult.result,
      rawResultType: parsed.payload.rawResultType,
      rawResult: parsed.payload.rawResult,
      readOnlyState: readOnlyOutcome.readOnlyState,
      stdout: parsed.remainingStdout || null,
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
    await rm(files.cleanupPath, {
      recursive: true,
      force: true,
    });
  }
}
