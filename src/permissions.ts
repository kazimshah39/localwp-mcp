import { config } from "./config.js";
import type { AccessProfile } from "./types.js";

const restrictedWpFlags = new Set(["--path", "--ssh", "--http"]);

const wpCliAlwaysBlockedPrefixes = [
  ["db", "query"],
  ["eval"],
  ["eval-file"],
  ["package", "install"],
  ["package", "uninstall"],
  ["package", "update"],
  ["shell"],
];

const wpCliSafePrefixes = [
  ["cap", "list"],
  ["cli", "check-update"],
  ["cli", "cmd-dump"],
  ["cli", "info"],
  ["cli", "param-dump"],
  ["cli", "version"],
  ["comment", "get"],
  ["comment", "list"],
  ["config", "get"],
  ["config", "has"],
  ["config", "list"],
  ["core", "check-update"],
  ["core", "is-installed"],
  ["core", "verify-checksums"],
  ["core", "version"],
  ["cron", "event", "list"],
  ["cron", "test"],
  ["db", "check"],
  ["db", "columns"],
  ["db", "prefix"],
  ["db", "search"],
  ["db", "size"],
  ["db", "tables"],
  ["embed", "fetch"],
  ["language", "core", "list"],
  ["language", "plugin", "list"],
  ["language", "theme", "list"],
  ["media", "get"],
  ["media", "image-size"],
  ["menu", "item", "list"],
  ["menu", "list"],
  ["network", "meta", "get"],
  ["network", "meta", "list"],
  ["option", "get"],
  ["option", "list"],
  ["package", "browse"],
  ["package", "list"],
  ["plugin", "get"],
  ["plugin", "is-active"],
  ["plugin", "is-installed"],
  ["plugin", "list"],
  ["plugin", "path"],
  ["plugin", "status"],
  ["plugin", "verify-checksums"],
  ["post", "get"],
  ["post", "list"],
  ["post", "url"],
  ["profile", "hook"],
  ["profile", "stage"],
  ["rewrite", "list"],
  ["role", "exists"],
  ["role", "get"],
  ["role", "list"],
  ["site", "archive", "list"],
  ["site", "empty", "list"],
  ["site", "list"],
  ["site", "meta", "get"],
  ["site", "meta", "list"],
  ["super-admin", "list"],
  ["taxonomy", "get"],
  ["taxonomy", "list"],
  ["term", "get"],
  ["term", "list"],
  ["theme", "get"],
  ["theme", "is-active"],
  ["theme", "is-installed"],
  ["theme", "list"],
  ["theme", "path"],
  ["theme", "status"],
  ["transient", "get"],
  ["transient", "type"],
  ["user", "application-password", "list"],
  ["user", "cap", "list"],
  ["user", "get"],
  ["user", "list"],
  ["user", "meta", "get"],
  ["user", "meta", "list"],
  ["user", "session", "list"],
  ["widget", "list"],
  ["widget", "type", "list"],
];

export function assertAllowedWpFlags(args: string[]) {
  for (const arg of args) {
    const flag = arg.split("=")[0];

    if (restrictedWpFlags.has(flag)) {
      throw new Error(
        `The '${flag}' flag is not allowed here because the MCP selects the Local site for you.`,
      );
    }
  }
}

export function assertWpCliPermissions(args: string[]) {
  return assertWpCliPermissionsForProfile(config.profile, args);
}

export function assertWpCliPermissionsForProfile(
  profile: AccessProfile,
  args: string[],
) {
  if (matchesAnyPrefix(args, wpCliAlwaysBlockedPrefixes)) {
    throw new Error(
      "This WP-CLI command is blocked in this MCP because it behaves like arbitrary code execution or unrestricted SQL.",
    );
  }

  if (profile === "full-access") {
    return;
  }

  if (
    startsWithCommand(args, ["search-replace"]) &&
    args.includes("--dry-run")
  ) {
    return;
  }

  if (!matchesAnyPrefix(args, wpCliSafePrefixes)) {
    throw new Error(
      "This WP-CLI command is not allowed in the 'safe' profile. Switch to LOCALWP_MCP_PROFILE=full-access for broad WP-CLI access.",
    );
  }
}

function matchesAnyPrefix(args: string[], prefixes: string[][]) {
  return prefixes.some((prefix) => startsWithCommand(args, prefix));
}

function startsWithCommand(args: string[], prefix: string[]) {
  if (prefix.length > args.length) {
    return false;
  }

  return prefix.every((token, index) => args[index] === token);
}
