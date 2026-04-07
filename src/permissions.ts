import { config } from "./config.js";
import { StructuredToolError } from "./errors.js";
import type { AccessProfile } from "./types.js";

const restrictedWpFlags = new Map([
  [
    "--path",
    {
      policyCode: "wp_cli_site_selection_flag_blocked",
      message:
        "The '--path' flag is not allowed here because the MCP selects the Local site for you.",
      reason:
        "Site-selection flags are controlled by the MCP so the selected Local site stays authoritative.",
      suggestedAlternatives: [
        "Pass siteName or siteId in the tool call instead.",
      ],
    },
  ],
  [
    "--ssh",
    {
      policyCode: "wp_cli_site_selection_flag_blocked",
      message:
        "The '--ssh' flag is not allowed here because the MCP selects the Local site for you.",
      reason:
        "Site-selection flags are controlled by the MCP so the selected Local site stays authoritative.",
      suggestedAlternatives: [
        "Pass siteName or siteId in the tool call instead.",
      ],
    },
  ],
  [
    "--http",
    {
      policyCode: "wp_cli_site_selection_flag_blocked",
      message:
        "The '--http' flag is not allowed here because the MCP selects the Local site for you.",
      reason:
        "Site-selection flags are controlled by the MCP so the selected Local site stays authoritative.",
      suggestedAlternatives: [
        "Pass siteName or siteId in the tool call instead.",
      ],
    },
  ],
  [
    "--require",
    {
      policyCode: "wp_cli_require_flag_blocked",
      message:
        "The '--require' flag is not allowed here because it can load arbitrary PHP before WP-CLI runs.",
      reason:
        "The --require flag can load arbitrary PHP before WP-CLI runs, so it is reserved for dedicated MCP runtime tools.",
      suggestedAlternatives: [
        "Use execute_wp_php_readonly for protected runtime snippets.",
        "Use execute_wp_php for high-trust runtime PHP.",
        "Use wp_call_function or wp_call_static_method for read-oriented runtime inspection.",
      ],
    },
  ],
  [
    "--exec",
    {
      policyCode: "wp_cli_exec_flag_blocked",
      message:
        "The '--exec' flag is not allowed here because it can execute arbitrary PHP before WP-CLI runs.",
      reason:
        "The --exec flag can execute arbitrary PHP before WP-CLI runs, so it is reserved for dedicated MCP runtime tools.",
      suggestedAlternatives: [
        "Use execute_wp_php_readonly for protected runtime snippets.",
        "Use execute_wp_php for high-trust runtime PHP.",
        "Use wp_call_function or wp_call_static_method for read-oriented runtime inspection.",
      ],
    },
  ],
  [
    "--config",
    {
      policyCode: "wp_cli_config_flag_blocked",
      message:
        "The '--config' flag is not allowed here because it can replace the managed WP-CLI configuration.",
      reason:
        "The --config flag can replace the managed WP-CLI configuration and weaken MCP guardrails.",
      suggestedAlternatives: [
        "Use local_site_info to inspect the managed WP-CLI runtime context.",
      ],
    },
  ],
]);

const wpCliAlwaysBlockedRules = [
  {
    prefix: ["db", "query"],
    policyCode: "wp_cli_db_query_blocked",
    blockedFeature: "db query",
    reason:
      "WP-CLI database query execution is disabled here because it bypasses the MCP's SQL access controls.",
    suggestedAlternatives: ["mysql_query", "mysql_execute in full-access"],
  },
  {
    prefix: ["eval"],
    policyCode: "wp_cli_eval_blocked",
    blockedFeature: "eval",
    reason:
      "Inline WP-CLI eval is disabled because it enables arbitrary PHP execution through the general WP-CLI tool.",
    suggestedAlternatives: [
      "execute_wp_php_readonly for protected runtime snippets",
      "execute_wp_php in full-access",
      "execute_wp_cli with standard WP-CLI commands",
      "mysql_query for read-only SQL inspection",
    ],
  },
  {
    prefix: ["eval-file"],
    policyCode: "wp_cli_eval_file_blocked",
    blockedFeature: "eval-file",
    reason:
      "WP-CLI eval-file is reserved for the dedicated runtime PHP tool so file-based execution can stay explicit and easier to audit.",
    suggestedAlternatives: [
      "execute_wp_php_readonly for protected runtime snippets",
      "execute_wp_php in full-access",
      "execute_wp_cli with standard WP-CLI commands",
    ],
  },
  {
    prefix: ["package", "install"],
    policyCode: "wp_cli_package_install_blocked",
    blockedFeature: "package install",
    reason:
      "WP-CLI package installation is blocked because it mutates shared tooling outside the selected Local site.",
    suggestedAlternatives: ["package browse", "package list"],
  },
  {
    prefix: ["package", "uninstall"],
    policyCode: "wp_cli_package_uninstall_blocked",
    blockedFeature: "package uninstall",
    reason:
      "WP-CLI package removal is blocked because it mutates shared tooling outside the selected Local site.",
    suggestedAlternatives: ["package browse", "package list"],
  },
  {
    prefix: ["package", "update"],
    policyCode: "wp_cli_package_update_blocked",
    blockedFeature: "package update",
    reason:
      "WP-CLI package updates are blocked because they mutate shared tooling outside the selected Local site.",
    suggestedAlternatives: ["package browse", "package list"],
  },
  {
    prefix: ["shell"],
    policyCode: "wp_cli_shell_blocked",
    blockedFeature: "shell",
    reason:
      "Interactive WP-CLI shell access is blocked because it would bypass the MCP's non-interactive guardrails.",
    suggestedAlternatives: [
      "execute_wp_cli with standard commands",
      "execute_wp_php_readonly for protected runtime snippets",
      "execute_wp_php in full-access",
    ],
  },
] as const;

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
    const restrictedFlag = restrictedWpFlags.get(flag);

    if (restrictedFlag) {
      throw new StructuredToolError({
        error: "blocked_command",
        message: restrictedFlag.message,
        policyCode: restrictedFlag.policyCode,
        policy_code: restrictedFlag.policyCode,
        blockedFeature: flag,
        blocked_feature: flag,
        reason: restrictedFlag.reason,
        args,
        suggestedAlternatives: restrictedFlag.suggestedAlternatives,
        suggested_alternatives: restrictedFlag.suggestedAlternatives,
      });
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
  const blockedRule = findMatchingPrefixRule(args, wpCliAlwaysBlockedRules);
  if (blockedRule) {
    throw new StructuredToolError({
      error: "blocked_command",
      message:
        `This WP-CLI command is blocked in this MCP. ${blockedRule.reason}`,
      policyCode: blockedRule.policyCode,
      policy_code: blockedRule.policyCode,
      blockedFeature: blockedRule.blockedFeature,
      blocked_feature: blockedRule.blockedFeature,
      reason: blockedRule.reason,
      args,
      accessProfile: profile,
      access_profile: profile,
      suggestedAlternatives: blockedRule.suggestedAlternatives,
      suggested_alternatives: blockedRule.suggestedAlternatives,
    });
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
    throw new StructuredToolError({
      error: "blocked_command",
      message:
        "This WP-CLI command is not allowed in the 'safe' profile. Switch to LOCALWP_MCP_PROFILE=full-access for broad WP-CLI access.",
      policyCode: "wp_cli_safe_profile_blocked",
      policy_code: "wp_cli_safe_profile_blocked",
      blockedFeature: args.slice(0, 2).join(" ") || args[0] || "unknown",
      blocked_feature: args.slice(0, 2).join(" ") || args[0] || "unknown",
      reason:
        "The 'safe' profile only allows the curated set of inspection-oriented WP-CLI commands.",
      args,
      accessProfile: profile,
      access_profile: profile,
      requiredProfile: "full-access",
      required_profile: "full-access",
      suggestedAlternatives: [
        "Use one of the read-oriented WP-CLI commands allowed in safe mode.",
        "Switch to LOCALWP_MCP_PROFILE=full-access for broader WP-CLI access.",
      ],
      suggested_alternatives: [
        "Use one of the read-oriented WP-CLI commands allowed in safe mode.",
        "Switch to LOCALWP_MCP_PROFILE=full-access for broader WP-CLI access.",
      ],
    });
  }
}

function matchesAnyPrefix(args: string[], prefixes: string[][]) {
  return prefixes.some((prefix) => startsWithCommand(args, prefix));
}

function findMatchingPrefixRule<
  T extends {
    prefix: readonly string[];
  },
>(args: string[], rules: readonly T[]) {
  return rules.find((rule) => startsWithCommand(args, [...rule.prefix]));
}

function startsWithCommand(args: string[], prefix: string[]) {
  if (prefix.length > args.length) {
    return false;
  }

  return prefix.every((token, index) => args[index] === token);
}
