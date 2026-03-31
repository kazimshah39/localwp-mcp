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
  } = {},
) {
  return runWpCliArgs(context, tokenizeCommand(command), options);
}

export async function runWpCliArgs(
  context: SiteContext,
  rawArgs: string[],
  options: {
    skipPermissionCheck?: boolean;
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

  assertAllowedWpFlags(args);
  if (!options.skipPermissionCheck) {
    assertWpCliPermissions(args);
  }

  const tooling = await resolveLocalTooling();
  const env = buildWpCliEnv(context, tooling);
  const processArgs = [tooling.wpCliPhar, `--path=${context.wpRoot}`, ...args];
  const result = await spawnCommand(context.php.binaryPath, processArgs, {
    cwd: context.wpRoot,
    env,
  });

  if (result.timedOut) {
    throw new Error(
      `WP-CLI timed out after ${config.defaultTimeoutMs / 1000}s for site '${context.site.name}'.`,
    );
  }

  if (result.exitCode !== 0) {
    throw new Error(
      [
        `WP-CLI exited with code ${result.exitCode} for site '${context.site.name}'.`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }

  return {
    stdout: result.stdout || "Command executed successfully with no output.",
    stderr: result.stderr,
  };
}

function buildWpCliEnv(
  context: SiteContext,
  tooling: Awaited<ReturnType<typeof resolveLocalTooling>>,
) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PHPRC: context.phpConfigDir,
    WP_CLI_DISABLE_AUTO_CHECK_UPDATE: "1",
    PATH: [
      path.dirname(context.mysql.binaryPath),
      path.dirname(context.php.binaryPath),
      path.dirname(tooling.wpCliPhar),
      ...tooling.helperBinDirs,
      process.env.PATH,
    ]
      .filter(Boolean)
      .join(path.delimiter),
  };

  if (tooling.wpCliConfig) {
    env.WP_CLI_CONFIG_PATH = tooling.wpCliConfig;
  }

  if (context.magickCoderModulePath) {
    env.MAGICK_CODER_MODULE_PATH = context.magickCoderModulePath;
  }

  return env;
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
