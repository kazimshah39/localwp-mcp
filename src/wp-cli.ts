import path from "path";

import { config } from "./config.js";
import { resolveLocalTooling } from "./local-tooling.js";
import { assertAllowedWpFlags, assertWpCliPermissions } from "./permissions.js";
import { spawnCommand } from "./process-utils.js";
import type { SiteContext } from "./types.js";

export async function runWpCli(
  context: SiteContext,
  command: string,
  options: {
    skipPermissionCheck?: boolean;
    skipFlagValidation?: boolean;
  } = {},
) {
  return runWpCliArgs(context, tokenizeCommand(command), options);
}

export async function runWpCliArgs(
  context: SiteContext,
  rawArgs: string[],
  options: {
    skipPermissionCheck?: boolean;
    skipFlagValidation?: boolean;
  } = {},
) {
  const args = [...rawArgs];

  if (args[0] === "wp") {
    args.shift();
  }

  if (args.length === 0) {
    throw new Error(
      "Please pass WP-CLI arguments only, for example 'plugin list'.",
    );
  }

  if (!options.skipFlagValidation) {
    assertAllowedWpFlags(args);
  }

  if (!options.skipPermissionCheck) {
    assertWpCliPermissions(args);
  }

  const result = await runWpCliArgsRaw(context, args);
  assertWpCliProcessSucceeded(context, result);

  return {
    stdout: result.stdout || "Command executed successfully with no output.",
    stderr: result.stderr,
  };
}

export async function runWpCliArgsRaw(
  context: SiteContext,
  rawArgs: string[],
) {
  const execution = await resolveWpCliExecution(context);
  return spawnCommand(
    execution.command,
    [...execution.argsPrefix, ...rawArgs],
    {
      cwd: execution.cwd,
      env: execution.env,
    },
  );
}

export function assertWpCliProcessSucceeded(
  context: SiteContext,
  result: Awaited<ReturnType<typeof runWpCliArgsRaw>>,
) {
  if (result.timedOut) {
    throw new Error(
      `WP-CLI timed out after ${config.defaultTimeoutMs / 1000}s for site '${context.site.name}'.`,
    );
  }

  if (result.exitCode !== 0) {
    throw new Error(formatWpCliProcessError(context, result));
  }
}

export function formatWpCliProcessError(
  context: SiteContext,
  result: Awaited<ReturnType<typeof runWpCliArgsRaw>>,
) {
  return [
    `WP-CLI exited with code ${result.exitCode} for site '${context.site.name}'.`,
    result.stdout,
    result.stderr,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function resolveWpCliExecution(context: SiteContext) {
  const tooling = await resolveLocalTooling();
  const pathEntries = buildWpCliPathEntries(context, tooling);

  return {
    tooling,
    command: context.php.binaryPath,
    argsPrefix: [tooling.wpCliPhar, `--path=${context.wpRoot}`],
    cwd: context.wpRoot,
    env: buildWpCliEnv(context, tooling, pathEntries),
    pathEntries,
  };
}

function buildWpCliEnv(
  context: SiteContext,
  tooling: Awaited<ReturnType<typeof resolveLocalTooling>>,
  pathEntries: string[],
) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PHPRC: context.phpConfigDir,
    WP_CLI_DISABLE_AUTO_CHECK_UPDATE: "1",
    PATH: [...pathEntries, process.env.PATH].filter(Boolean).join(path.delimiter),
  };

  if (tooling.wpCliConfig) {
    env.WP_CLI_CONFIG_PATH = tooling.wpCliConfig;
  }

  const phpRuntimeDir =
    context.php.platformDirName
      ? path.join(context.php.packageDir, "bin", context.php.platformDirName)
      : path.dirname(context.php.binaryPath);
  const imageMagickDir =
    config.platform === "win32" && context.php.platformDirName
      ? path.join(phpRuntimeDir, "ImageMagick")
      : null;
  const ghostscriptLibDir =
    config.platform === "win32" && context.php.platformDirName
      ? path.join(phpRuntimeDir, "ghostscript", "Resource", "Init")
      : null;

  if (context.magickCoderModulePath) {
    env.MAGICK_CODER_MODULE_PATH = context.magickCoderModulePath;
  }

  if (imageMagickDir) {
    env.MAGICK_CONFIGURE_PATH = imageMagickDir;
  }

  if (ghostscriptLibDir) {
    env.GS_LIB = ghostscriptLibDir;
  }

  return env;
}

function buildWpCliPathEntries(
  context: SiteContext,
  tooling: Awaited<ReturnType<typeof resolveLocalTooling>>,
) {
  const phpRuntimeDir =
    context.php.platformDirName
      ? path.join(context.php.packageDir, "bin", context.php.platformDirName)
      : path.dirname(context.php.binaryPath);
  const imageMagickDir =
    config.platform === "win32" && context.php.platformDirName
      ? path.join(phpRuntimeDir, "ImageMagick")
      : null;
  const ghostscriptBinDir =
    config.platform === "win32" && context.php.platformDirName
      ? path.join(phpRuntimeDir, "ghostscript", "bin")
      : null;

  return [
    imageMagickDir,
    ghostscriptBinDir,
    path.dirname(context.mysql.binaryPath),
    path.dirname(context.php.binaryPath),
    path.dirname(tooling.wpCliPhar),
    ...tooling.helperBinDirs,
  ].filter(Boolean) as string[];
}

export function tokenizeCommand(command: string) {
  const input = command.trim();

  if (!input) {
    throw new Error("Command cannot be empty.");
  }

  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;
  let buildingToken = false;

  for (const character of input) {
    if (escaping) {
      current += character;
      escaping = false;
      buildingToken = true;
      continue;
    }

    if (quote === "'") {
      if (character === "'") {
        quote = null;
      } else {
        current += character;
      }
      buildingToken = true;
      continue;
    }

    if (quote === '"') {
      if (character === '"') {
        quote = null;
      } else if (character === "\\") {
        escaping = true;
      } else {
        current += character;
      }
      buildingToken = true;
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      buildingToken = true;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      buildingToken = true;
      continue;
    }

    if (/\s/.test(character)) {
      if (buildingToken) {
        tokens.push(current);
        current = "";
        buildingToken = false;
      }
      continue;
    }

    current += character;
    buildingToken = true;
  }

  if (quote) {
    throw new Error("Command contains an unterminated quote.");
  }

  if (escaping) {
    throw new Error("Command ends with an unfinished escape sequence.");
  }

  if (buildingToken) {
    tokens.push(current);
  }

  return tokens;
}
