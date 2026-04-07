import os from "os";
import path from "path";
import { mkdtemp, realpath, stat, writeFile } from "fs/promises";

import { isReadablePath } from "./process-utils.js";

export interface PreparedWpPhpSource {
  mode: "inline" | "file";
  absolutePath: string;
  sourcePath: string | null;
  cleanupPath: string | null;
}

export interface PreparedWpRuntimeCallFiles {
  cleanupPath: string;
  guardPath: string;
  scriptPath: string;
}

export interface PreparedReadonlyWpPhpExecutionFiles {
  cleanupPaths: string[];
  guardPath: string;
  scriptPath: string;
  sourceMode: "inline" | "file";
  sourcePath: string | null;
}

export interface ReadOnlyRuntimeState {
  blockedSideEffects: string[];
  blockedSqlVerbs: string[];
  blockedSqlCount: number;
  blockedHttpCount: number;
  blockedMailCount: number;
  writesBlocked: boolean;
  sideEffectsPrevented: boolean;
  transactionStarted: boolean;
  transactionRolledBack: boolean;
  transactionCommitted: boolean;
}

export interface WpRuntimeCallResultPayload {
  ok: boolean;
  callType: "function" | "static_method";
  callable: string;
  args: unknown[];
  rawResultType: string;
  rawResult: unknown;
  readOnlyState?: ReadOnlyRuntimeState;
}

export interface WpReadonlyPhpExecutionPayload {
  ok: boolean;
  stdout: string;
  rawResultType: string;
  rawResult: unknown;
  readOnlyState?: ReadOnlyRuntimeState;
}

export async function prepareWpPhpSource(options: {
  siteRoot: string;
  phpCode?: string;
  filePath?: string;
  cwd?: string;
}): Promise<PreparedWpPhpSource> {
  const hasPhpCode = Boolean(options.phpCode?.trim());
  const hasFilePath = Boolean(options.filePath?.trim());

  if (hasPhpCode === hasFilePath) {
    throw new Error("Pass exactly one of 'phpCode' or 'filePath'.");
  }

  if (hasFilePath) {
    const absolutePath = await resolveTrustedWpPhpFilePath(
      options.siteRoot,
      options.filePath!,
      {
        cwd: options.cwd,
      },
    );

    return {
      mode: "file",
      absolutePath,
      sourcePath: absolutePath,
      cleanupPath: null,
    };
  }

  const tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "localwp-mcp-wp-php-"),
  );
  const absolutePath = path.join(tempDirectory, "runtime-inspect.php");
  await writeFile(absolutePath, normalizeInlinePhpCode(options.phpCode!), "utf8");

  return {
    mode: "inline",
    absolutePath,
    sourcePath: null,
    cleanupPath: tempDirectory,
  };
}

export function normalizeInlinePhpCode(phpCode: string) {
  const trimmed = phpCode.trim();

  if (!trimmed) {
    throw new Error("The inline PHP snippet cannot be empty.");
  }

  if (
    trimmed.startsWith("<?php") ||
    trimmed.startsWith("<?=") ||
    trimmed.startsWith("<?")
  ) {
    return phpCode.endsWith("\n") ? phpCode : `${phpCode}\n`;
  }

  return `<?php\n${phpCode}${phpCode.endsWith("\n") ? "" : "\n"}`;
}

export function parseWpRuntimeArgsJson(argsJson: string | undefined) {
  if (!argsJson?.trim()) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(argsJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`The 'argsJson' value must be valid JSON: ${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("The 'argsJson' value must decode to a JSON array.");
  }

  return parsed;
}

export function assertPhpFunctionIdentifier(functionName: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_\\]*$/.test(functionName)) {
    throw new Error(
      "Function names may only contain letters, numbers, underscores, and namespace separators.",
    );
  }
}

export function assertPhpMethodIdentifier(methodName: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(methodName)) {
    throw new Error(
      "Method names may only contain letters, numbers, and underscores.",
    );
  }
}

export function assertPhpClassIdentifier(className: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_\\]*$/.test(className)) {
    throw new Error(
      "Class names may only contain letters, numbers, underscores, and namespace separators.",
    );
  }
}

export async function prepareWpRuntimeCallFiles(options: {
  callType: "function" | "static_method";
  functionName?: string;
  className?: string;
  methodName?: string;
  args: unknown[];
}) {
  const tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "localwp-mcp-wp-call-"),
  );
  const guardPath = path.join(tempDirectory, "read-only-guard.php");
  const scriptPath = path.join(tempDirectory, "call.php");

  await writeFile(guardPath, buildReadOnlyGuardPhp(), "utf8");
  await writeFile(
    scriptPath,
    buildWpRuntimeCallPhp({
      callType: options.callType,
      functionName: options.functionName,
      className: options.className,
      methodName: options.methodName,
      args: options.args,
    }),
    "utf8",
  );

  return {
    cleanupPath: tempDirectory,
    guardPath,
    scriptPath,
  } satisfies PreparedWpRuntimeCallFiles;
}

export async function prepareReadonlyWpPhpExecutionFiles(options: {
  siteRoot: string;
  phpCode?: string;
  filePath?: string;
  cwd?: string;
}) {
  const source = await prepareWpPhpSource(options);
  const tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "localwp-mcp-wp-readonly-"),
  );
  const guardPath = path.join(tempDirectory, "read-only-guard.php");
  const scriptPath = path.join(tempDirectory, "execute-readonly.php");

  await writeFile(guardPath, buildReadOnlyGuardPhp(), "utf8");
  await writeFile(
    scriptPath,
    buildReadonlyPhpExecutionPhp(source.absolutePath),
    "utf8",
  );

  return {
    cleanupPaths: [tempDirectory, ...(source.cleanupPath ? [source.cleanupPath] : [])],
    guardPath,
    scriptPath,
    sourceMode: source.mode,
    sourcePath: source.sourcePath,
  } satisfies PreparedReadonlyWpPhpExecutionFiles;
}

export function extractWpRuntimeCallPayload(stdout: string) {
  return extractMarkedJsonPayload<WpRuntimeCallResultPayload>(
    stdout,
    "The runtime call did not return a structured payload. Check stdout/stderr for PHP notices or fatal errors.",
  );
}

export function extractWpReadonlyPhpPayload(stdout: string) {
  return extractMarkedJsonPayload<WpReadonlyPhpExecutionPayload>(
    stdout,
    "The read-only PHP execution did not return a structured payload. Check stdout/stderr for PHP notices or fatal errors.",
  );
}

export function normalizeReadOnlyRuntimeState(
  readOnlyState?: Partial<ReadOnlyRuntimeState> | null,
): ReadOnlyRuntimeState {
  const blockedSideEffects = Array.from(
    new Set((readOnlyState?.blockedSideEffects || []).filter(Boolean)),
  );
  const blockedSqlVerbs = Array.from(
    new Set((readOnlyState?.blockedSqlVerbs || []).filter(Boolean)),
  );
  const blockedSqlCount = Math.max(0, Number(readOnlyState?.blockedSqlCount || 0));
  const blockedHttpCount = Math.max(
    0,
    Number(readOnlyState?.blockedHttpCount || 0),
  );
  const blockedMailCount = Math.max(
    0,
    Number(readOnlyState?.blockedMailCount || 0),
  );

  if (blockedSqlCount > 0 || blockedSqlVerbs.length > 0) {
    blockedSideEffects.push("sql_write");
  }

  if (blockedHttpCount > 0) {
    blockedSideEffects.push("http_request");
  }

  if (blockedMailCount > 0) {
    blockedSideEffects.push("mail");
  }

  const uniqueBlockedSideEffects = Array.from(new Set(blockedSideEffects));
  const writesBlocked =
    Boolean(readOnlyState?.writesBlocked) ||
    blockedSqlCount > 0 ||
    blockedSqlVerbs.length > 0 ||
    uniqueBlockedSideEffects.includes("sql_write");
  const sideEffectsPrevented =
    Boolean(readOnlyState?.sideEffectsPrevented) ||
    writesBlocked ||
    blockedHttpCount > 0 ||
    blockedMailCount > 0 ||
    uniqueBlockedSideEffects.length > 0;

  return {
    blockedSideEffects: uniqueBlockedSideEffects,
    blockedSqlVerbs,
    blockedSqlCount,
    blockedHttpCount,
    blockedMailCount,
    writesBlocked,
    sideEffectsPrevented,
    transactionStarted: Boolean(readOnlyState?.transactionStarted),
    transactionRolledBack: Boolean(readOnlyState?.transactionRolledBack),
    transactionCommitted: Boolean(readOnlyState?.transactionCommitted),
  };
}

export function describeReadOnlyRuntimeOutcome(
  readOnlyState?: Partial<ReadOnlyRuntimeState> | null,
) {
  const normalizedReadOnlyState = normalizeReadOnlyRuntimeState(readOnlyState);

  if (!normalizedReadOnlyState.sideEffectsPrevented) {
    return {
      outcome: "ok" as const,
      readOnlyState: normalizedReadOnlyState,
      blockedResult: null,
    };
  }

  return {
    outcome: "blocked_side_effects" as const,
    readOnlyState: normalizedReadOnlyState,
    blockedResult: {
      status: "blocked",
      reason:
        "Read-only guard prevented one or more side effects, so the raw return value is not authoritative.",
      blockedSideEffects: normalizedReadOnlyState.blockedSideEffects,
      writesBlocked: normalizedReadOnlyState.writesBlocked,
      sideEffectsPrevented: normalizedReadOnlyState.sideEffectsPrevented,
      transactionStarted: normalizedReadOnlyState.transactionStarted,
      transactionRolledBack: normalizedReadOnlyState.transactionRolledBack,
      transactionCommitted: normalizedReadOnlyState.transactionCommitted,
    },
  };
}

export function resolveReadOnlyRuntimeResult(options: {
  rawResultType: string;
  rawResult: unknown;
  readOnlyState?: Partial<ReadOnlyRuntimeState> | null;
}) {
  const { outcome, readOnlyState, blockedResult } = describeReadOnlyRuntimeOutcome(
    options.readOnlyState,
  );

  if (outcome === "ok") {
    return {
      outcome,
      readOnlyState,
      rawResultType: options.rawResultType,
      rawResult: options.rawResult,
      resultType: options.rawResultType,
      result: options.rawResult,
    };
  }

  return {
    outcome,
    readOnlyState,
    rawResultType: options.rawResultType,
    rawResult: options.rawResult,
    resultType: "localwp_mcp_read_only_blocked",
    result: {
      ...blockedResult,
      rawResultType: options.rawResultType,
      rawResult: options.rawResult,
    },
  };
}

function extractMarkedJsonPayload<T>(stdout: string, missingPayloadMessage: string) {
  const startMarker = "LOCALWP_MCP_JSON_START";
  const endMarker = "LOCALWP_MCP_JSON_END";
  const startIndex = stdout.indexOf(startMarker);
  const endIndex = stdout.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(missingPayloadMessage);
  }

  const jsonText = stdout
    .slice(startIndex + startMarker.length, endIndex)
    .trim();
  const leadingStdout = stdout.slice(0, startIndex).trim();
  const trailingStdout = stdout.slice(endIndex + endMarker.length).trim();
  const remainingStdout = [leadingStdout, trailingStdout]
    .filter(Boolean)
    .join("\n");

  try {
    return {
      payload: JSON.parse(jsonText) as T,
      remainingStdout,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `The runtime call returned an unreadable JSON payload: ${message}`,
    );
  }
}

export async function resolveTrustedWpPhpFilePath(
  siteRoot: string,
  requestedPath: string,
  options: {
    cwd?: string;
  } = {},
) {
  const trimmedPath = requestedPath.trim();

  if (!trimmedPath) {
    throw new Error("The 'filePath' value cannot be empty.");
  }

  const baseCwd = options.cwd || process.cwd();
  const absolutePath = path.isAbsolute(trimmedPath)
    ? path.resolve(trimmedPath)
    : path.resolve(baseCwd, trimmedPath);

  if (path.extname(absolutePath).toLowerCase() !== ".php") {
    throw new Error("Runtime PHP tools only allow readable '.php' files.");
  }

  if (!(await isReadablePath(absolutePath))) {
    throw new Error(`The PHP file '${requestedPath}' is not readable.`);
  }

  const fileStats = await stat(absolutePath);
  if (!fileStats.isFile()) {
    throw new Error(
      `The path '${requestedPath}' is not a regular PHP file.`,
    );
  }

  const targetRealPath = await realpath(absolutePath);
  const allowedBases = await collectAllowedScriptBases(siteRoot, baseCwd);

  if (!allowedBases.some((basePath) => isPathWithinBase(basePath, targetRealPath))) {
    throw new Error(
      "The PHP file must live inside the selected Local site or the MCP working directory.",
    );
  }

  return absolutePath;
}

async function collectAllowedScriptBases(siteRoot: string, cwd: string) {
  const basePaths = [await realpath(siteRoot)];

  if (!(await isReadablePath(cwd)) || isFilesystemRoot(cwd)) {
    return basePaths;
  }

  const cwdRealPath = await realpath(cwd);
  if (!basePaths.includes(cwdRealPath)) {
    basePaths.push(cwdRealPath);
  }

  return basePaths;
}

function isFilesystemRoot(candidatePath: string) {
  const resolvedPath = path.resolve(candidatePath);
  return resolvedPath === path.parse(resolvedPath).root;
}

function isPathWithinBase(basePath: string, candidatePath: string) {
  const relativePath = path.relative(basePath, candidatePath);
  return (
    relativePath === "" ||
    relativePath === "." ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function buildReadOnlyGuardPhp() {
  return `<?php
if (!defined('DISALLOW_FILE_MODS')) {
    define('DISALLOW_FILE_MODS', true);
}
if (!defined('AUTOMATIC_UPDATER_DISABLED')) {
    define('AUTOMATIC_UPDATER_DISABLED', true);
}

$GLOBALS['localwp_mcp_read_only_state'] = [
    'blockedSideEffects' => [],
    'blockedSqlVerbs' => [],
    'blockedSqlCount' => 0,
    'blockedHttpCount' => 0,
    'blockedMailCount' => 0,
    'writesBlocked' => false,
    'sideEffectsPrevented' => false,
    'transactionStarted' => false,
    'transactionRolledBack' => false,
    'transactionCommitted' => false,
    'finalized' => false,
];

function localwp_mcp_mark_blocked_side_effect($effect) {
    if (!in_array($effect, $GLOBALS['localwp_mcp_read_only_state']['blockedSideEffects'], true)) {
        $GLOBALS['localwp_mcp_read_only_state']['blockedSideEffects'][] = $effect;
    }

    $GLOBALS['localwp_mcp_read_only_state']['sideEffectsPrevented'] = true;
}

function localwp_mcp_get_read_only_state() {
    $state = $GLOBALS['localwp_mcp_read_only_state'];

    $state['blockedSideEffects'] = array_values(array_unique($state['blockedSideEffects'] ?? []));
    $state['blockedSqlVerbs'] = array_values(array_unique($state['blockedSqlVerbs'] ?? []));
    $state['blockedSqlCount'] = (int) ($state['blockedSqlCount'] ?? 0);
    $state['blockedHttpCount'] = (int) ($state['blockedHttpCount'] ?? 0);
    $state['blockedMailCount'] = (int) ($state['blockedMailCount'] ?? 0);
    $state['writesBlocked'] =
        !empty($state['writesBlocked']) ||
        $state['blockedSqlCount'] > 0 ||
        !empty($state['blockedSqlVerbs']);
    $state['sideEffectsPrevented'] =
        !empty($state['sideEffectsPrevented']) ||
        $state['writesBlocked'] ||
        $state['blockedHttpCount'] > 0 ||
        $state['blockedMailCount'] > 0 ||
        !empty($state['blockedSideEffects']);
    $state['transactionStarted'] = !empty($state['transactionStarted']);
    $state['transactionRolledBack'] = !empty($state['transactionRolledBack']);
    $state['transactionCommitted'] = !empty($state['transactionCommitted']);

    return $state;
}

function localwp_mcp_finalize_read_only_state() {
    if (!empty($GLOBALS['localwp_mcp_read_only_state']['finalized'])) {
        return localwp_mcp_get_read_only_state();
    }

    global $wpdb;

    if (
        !empty($GLOBALS['localwp_mcp_read_only_state']['transactionStarted']) &&
        empty($GLOBALS['localwp_mcp_read_only_state']['transactionCommitted']) &&
        isset($wpdb) &&
        $wpdb instanceof wpdb
    ) {
        $rollback_result = @$wpdb->query('ROLLBACK');

        if (false !== $rollback_result) {
            $GLOBALS['localwp_mcp_read_only_state']['transactionRolledBack'] = true;
        }
    }

    $GLOBALS['localwp_mcp_read_only_state']['finalized'] = true;

    return localwp_mcp_get_read_only_state();
}

function localwp_mcp_normalize_value($value, $depth = 0) {
    if ($depth >= 6) {
        return ['__type' => 'truncated', 'message' => 'Maximum normalization depth reached.'];
    }

    if (is_null($value) || is_bool($value) || is_int($value) || is_float($value) || is_string($value)) {
        return $value;
    }

    if ($value instanceof WP_Error) {
        return [
            '__type' => 'WP_Error',
            'codes' => $value->get_error_codes(),
            'messages' => $value->get_error_messages(),
        ];
    }

    if ($value instanceof JsonSerializable) {
        return localwp_mcp_normalize_value($value->jsonSerialize(), $depth + 1);
    }

    if ($value instanceof Traversable) {
        return localwp_mcp_normalize_value(iterator_to_array($value), $depth + 1);
    }

    if (is_array($value)) {
        $normalized = [];

        foreach ($value as $key => $item) {
            $normalized[$key] = localwp_mcp_normalize_value($item, $depth + 1);
        }

        return $normalized;
    }

    if (is_object($value)) {
        $normalized = [
            '__type' => 'object',
            'class' => get_class($value),
            'properties' => [],
        ];

        foreach (get_object_vars($value) as $key => $item) {
            $normalized['properties'][$key] = localwp_mcp_normalize_value($item, $depth + 1);
        }

        if (method_exists($value, '__toString')) {
            try {
                $normalized['stringValue'] = (string) $value;
            } catch (Throwable $exception) {
                $normalized['stringValueError'] = $exception->getMessage();
            }
        }

        return $normalized;
    }

    return [
        '__type' => 'unknown',
        'description' => get_debug_type($value),
    ];
}

if (class_exists('WP_CLI')) {
    WP_CLI::add_hook('after_wp_load', function () {
        if (function_exists('add_filter')) {
            add_filter('pre_http_request', function ($pre, $parsed_args, $url) {
                $GLOBALS['localwp_mcp_read_only_state']['blockedHttpCount']++;
                localwp_mcp_mark_blocked_side_effect('http_request');

                return new WP_Error(
                    'localwp_mcp_read_only_http_blocked',
                    'HTTP requests are blocked during read-only runtime inspection.'
                );
            }, 10, 3);

            add_filter('pre_wp_mail', function ($return, $atts) {
                $GLOBALS['localwp_mcp_read_only_state']['blockedMailCount']++;
                localwp_mcp_mark_blocked_side_effect('mail');

                return new WP_Error(
                    'localwp_mcp_read_only_mail_blocked',
                    'Emails are blocked during read-only runtime inspection.'
                );
            }, 10, 2);

            add_filter('query', function ($query) {
                $normalized_query = preg_replace('/^\\s*(?:\\/\\*.*?\\*\\/\\s*)*/s', '', (string) $query);
                $verb = strtoupper((string) strtok($normalized_query, " \\t\\n\\r"));
                $allowed_verbs = ['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'SET', 'START', 'ROLLBACK', 'COMMIT'];

                if ($verb !== '' && !in_array($verb, $allowed_verbs, true)) {
                    $GLOBALS['localwp_mcp_read_only_state']['blockedSideEffects'][] = 'sql_write';
                    $GLOBALS['localwp_mcp_read_only_state']['blockedSqlVerbs'][] = $verb;
                    $GLOBALS['localwp_mcp_read_only_state']['blockedSqlCount']++;
                    $GLOBALS['localwp_mcp_read_only_state']['writesBlocked'] = true;
                    localwp_mcp_mark_blocked_side_effect('sql_write');
                    return 'SELECT 0 AS localwp_mcp_blocked_write';
                }

                return $query;
            });
        }

        global $wpdb;

        if (isset($wpdb) && $wpdb instanceof wpdb) {
            if (false !== $wpdb->query('SET SESSION TRANSACTION READ ONLY')) {
                if (false !== $wpdb->query('START TRANSACTION READ ONLY')) {
                    $GLOBALS['localwp_mcp_read_only_state']['transactionStarted'] = true;
                }
            }

            register_shutdown_function('localwp_mcp_finalize_read_only_state');
        }
    });
}
`;
}

function buildWpRuntimeCallPhp(options: {
  callType: "function" | "static_method";
  functionName?: string;
  className?: string;
  methodName?: string;
  args: unknown[];
}) {
  const argsLiteral = toPhpSingleQuotedString(JSON.stringify(options.args));
  const callableDescription =
    options.callType === "function"
      ? options.functionName || ""
      : `${options.className || ""}::${options.methodName || ""}`;
  const callableLiteral = toPhpSingleQuotedString(callableDescription);

  if (options.callType === "function") {
    assertPhpFunctionIdentifier(options.functionName || "");
  } else {
    assertPhpClassIdentifier(options.className || "");
    assertPhpMethodIdentifier(options.methodName || "");
  }

  const invocationPhp =
    options.callType === "function"
      ? `$callable_name = ${toPhpSingleQuotedString(options.functionName || "")};
if (!function_exists($callable_name)) {
    throw new RuntimeException(sprintf('Function %s does not exist in the loaded WordPress runtime.', $callable_name));
}

$result = call_user_func_array($callable_name, $args);`
      : `$class_name = ${toPhpSingleQuotedString(options.className || "")};
$method_name = ${toPhpSingleQuotedString(options.methodName || "")};
$callable = [$class_name, $method_name];

if (!is_callable($callable)) {
    throw new RuntimeException(
        sprintf(
            'Static method %s::%s is not callable in the loaded WordPress runtime.',
            $class_name,
            $method_name
        )
    );
}

$result = call_user_func_array($callable, $args);`;

  return `<?php
try {
    $args = json_decode(${argsLiteral}, true, 512, JSON_THROW_ON_ERROR);
    ${invocationPhp}
    $read_only_state = function_exists('localwp_mcp_finalize_read_only_state')
        ? localwp_mcp_finalize_read_only_state()
        : null;

    $payload = [
        'ok' => true,
        'callType' => ${toPhpSingleQuotedString(options.callType)},
        'callable' => ${callableLiteral},
        'args' => localwp_mcp_normalize_value($args),
        'rawResultType' => get_debug_type($result),
        'rawResult' => localwp_mcp_normalize_value($result),
        'readOnlyState' => $read_only_state,
    ];

    echo "\\nLOCALWP_MCP_JSON_START\\n";
    echo wp_json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    echo "\\nLOCALWP_MCP_JSON_END\\n";
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . PHP_EOL);
    exit(1);
}
`;
}

function buildReadonlyPhpExecutionPhp(sourcePath: string) {
  return `<?php
$source_path = ${toPhpSingleQuotedString(sourcePath)};

try {
    ob_start();
    $result = include $source_path;
    $stdout = ob_get_clean();
    $read_only_state = function_exists('localwp_mcp_finalize_read_only_state')
        ? localwp_mcp_finalize_read_only_state()
        : null;

    $payload = [
        'ok' => true,
        'stdout' => $stdout,
        'rawResultType' => get_debug_type($result),
        'rawResult' => localwp_mcp_normalize_value($result),
        'readOnlyState' => $read_only_state,
    ];

    echo "\\nLOCALWP_MCP_JSON_START\\n";
    echo wp_json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    echo "\\nLOCALWP_MCP_JSON_END\\n";
} catch (Throwable $exception) {
    if (ob_get_level() > 0) {
        $stdout = ob_get_clean();

        if ($stdout !== '') {
            fwrite(STDOUT, $stdout);
        }
    }

    fwrite(STDERR, $exception->getMessage() . PHP_EOL);
    exit(1);
}
`;
}

function toPhpSingleQuotedString(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
