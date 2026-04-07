# localwp-mcp

`localwp-mcp` gives AI agents direct access to LocalWP sites through MCP.

It automatically finds your Local sites, uses the correct Local PHP and MySQL runtimes for each one, and lets an agent work with WordPress through WP-CLI, MySQL, logs, diagnostics, backups, and restore flows.

## What You Can Do

- inspect Local sites and their runtime details
- start, stop, and restart Local sites
- list, read, search, write, and delete files inside a selected Local site
- run WP-CLI against the correct site
- query the WordPress database
- allow full database writes when you want unrestricted local development
- read recent logs and run site health checks
- export, import, back up, and restore LocalWP sites

## Install

Use `npx` in your MCP client:

```json
{
  "mcpServers": {
    "localwp": {
      "command": "npx",
      "args": ["-y", "localwp-mcp"],
      "env": {
        "LOCALWP_MCP_PROFILE": "safe"
      }
    }
  }
}
```

`localwp-mcp` currently supports `STDIO` clients. Streamable HTTP is not supported yet.

If you want the MCP to focus on one site by default, set:

```json
{
  "LOCAL_SITE_NAME": "example-site"
}
```

## Client Setup

Use these settings across supported clients:

- transport: `STDIO`
- command: `npx`
- arguments: `-y`, `localwp-mcp`
- default environment variable: `LOCALWP_MCP_PROFILE=safe`
- optional environment variables:
  - `LOCAL_SITE_NAME`
  - `LOCAL_SITE_ID`
  - `LOCALWP_MCP_BACKUPS_DIR`

Do not choose `Streamable HTTP`. `localwp-mcp` currently runs as a local stdio MCP server.

### Codex Desktop

In Codex Desktop:

1. Open `Settings`
2. Open `MCP servers`
3. Add a custom MCP
4. Choose `STDIO`

Then enter:

- Name: `localwp`
- Command to launch: `npx`
- Arguments:
  - `-y`
  - `localwp-mcp`
- Environment variables:
  - `LOCALWP_MCP_PROFILE` = `safe`
  - optional: `LOCAL_SITE_NAME` = `your-site-name`

### Cursor

Add this to your Cursor MCP config, for example `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "localwp": {
      "command": "npx",
      "args": ["-y", "localwp-mcp"],
      "env": {
        "LOCALWP_MCP_PROFILE": "safe"
      }
    }
  }
}
```

### Claude Code

Add the MCP through the Claude Code CLI.

macOS and Linux:

```bash
claude mcp add localwp -- npx -y localwp-mcp
```

Windows:

```powershell
claude mcp add localwp -- cmd /c npx -y localwp-mcp
```

The space before and after `--` is intentional. `--` is the separator between the Claude command and the command Claude should launch.

After adding the server, configure:

- `LOCALWP_MCP_PROFILE=safe`
- optional: `LOCAL_SITE_NAME=your-site-name`

### OpenCode

Use a local MCP server entry in your OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "localwp": {
      "type": "local",
      "command": ["npx", "-y", "localwp-mcp"],
      "enabled": true,
      "environment": {
        "LOCALWP_MCP_PROFILE": "safe"
      }
    }
  }
}
```

### Other STDIO MCP Clients

If your MCP client supports launching a local server over `STDIO`, use:

- command: `npx`
- arguments: `-y`, `localwp-mcp`
- environment: `LOCALWP_MCP_PROFILE=safe`

If a client only accepts an MCP URL and cannot launch a local command, it cannot use `localwp-mcp` yet.

## Access Modes

`localwp-mcp` has 2 access modes:

- `safe`
  Best default for most people. Safe WordPress inspection commands, read-oriented runtime calls, diagnostics, logs, database reads, and backup/export flows.
- `full-access`
  Best when you want the agent to fully work on your local site, including SQL writes, imports, restore operations, and explicit WordPress runtime PHP execution.

`safe` is the default.

To enable full local access:

```json
{
  "LOCALWP_MCP_PROFILE": "full-access"
}
```

## First Things To Try

Start with:

- `local_environment_check`
- `local_doctor`
- `list_local_sites`

Those will tell you:

- which Local sites were discovered
- whether the site is running
- which Local runtimes were resolved
- whether WP-CLI and MySQL are reachable

## Common Workflows

### Inspect a Site

Use:

- `local_site_info`
- `local_doctor`
- `local_logs`

`local_logs` accepts:

- `site`
- `global`
- `all`
- aliases: `both`, `combined`

### Work With Site Files

Use:

- `list_site_files`
- `read_site_file`
- `search_site_files`
- `write_site_file`
- `delete_site_file`

These tools are always scoped to the selected site's root directory.

- In `safe`, you can list, read, and search files.
- In `full-access`, you can also write and delete files.

### Control a Local Site

Use:

- `start_local_site`
- `stop_local_site`
- `restart_local_site`

### Work With WordPress

Use:

- `execute_wp_cli`
- `wp_call_function`
- `wp_call_static_method`
- `execute_wp_php_readonly`
- `execute_wp_php`

Examples:

- list plugins
- inspect options
- list posts or users
- run plugin-specific WP-CLI commands
- call a function or static method inside the loaded WordPress runtime with explicit JSON args
- run protected read-only PHP snippets or PHP files inside the loaded WordPress runtime
- run high-trust PHP snippets or PHP files inside the loaded WordPress runtime in `full-access`

`execute_wp_cli` is for ordinary WP-CLI commands. It intentionally blocks `eval`, `eval-file`, `shell`, and `db query`, and blocked commands return structured policy details with suggested alternatives.

`wp_call_function` and `wp_call_static_method` are read-oriented runtime inspection tools. They run inside the loaded WordPress runtime with explicit JSON arguments and add best-effort read-only guardrails around common SQL writes, HTTP requests, and outgoing email.

`execute_wp_php_readonly` is the protected arbitrary-snippet companion to those tools. It runs a PHP snippet or workspace/site `.php` file inside the loaded WordPress runtime with the same best-effort read-only guardrails, so you can inspect composed logic without jumping straight to unrestricted PHP execution. For snippet workflows, `stdout` is usually the primary output field, while `rawResultType` and `rawResult` preserve the underlying PHP include return value for debugging.

When a read-only tool blocks side effects, the top-level response becomes explicit instead of exposing a success-looking raw mutation result as authoritative. Those responses set `outcome` to `blocked_side_effects`, return a wrapped `result`, preserve the raw callable/snippet return value in `rawResultType` and `rawResult`, and include a richer `readOnlyState` with:

- `blockedSideEffects`
- `blockedSqlVerbs`
- `blockedSqlCount`
- `blockedHttpCount`
- `blockedMailCount`
- `writesBlocked`
- `sideEffectsPrevented`
- `transactionStarted`
- `transactionRolledBack`
- `transactionCommitted`

`execute_wp_php` is the explicit high-trust runtime path for `full-access`. It runs a PHP snippet or workspace/site `.php` file inside the selected site's loaded WordPress runtime using a file-based `eval-file` flow.

### Work With the Database

Use:

- `mysql_query`
  Read-only SQL in `safe`
- `mysql_execute`
  Full SQL execution in `full-access`
- `mysql_schema`
  Table listing and table description helpers

### Back Up or Restore a Site

Use:

- `backup_site`
- `list_backups`
- `delete_backup`
- `cleanup_backups`
- `db_export`
- `db_import`
- `preview_restore_backup`
- `restore_backup`

`backup_site` supports:

- `database`
- `full`

The `full` backup format is folder-based and includes the site's `app`, `conf`, and `logs` directories plus a fresh SQL dump.

If you want to manage backup storage over time:

- `list_backups`
  Shows the managed backup directories and SQL artifacts for a site.
- `delete_backup`
  Removes one managed backup artifact in `full-access`.
- `cleanup_backups`
  Cleans up older backups by age and/or retention count in `full-access`.

Use `preview_restore_backup` when you want to inspect the restore plan, effective restore mode, compatibility warnings, and current site state before making changes.

## Built-In Capabilities

### Tools

- `list_local_sites`
- `start_local_site`
- `stop_local_site`
- `restart_local_site`
- `local_environment_check`
- `local_doctor`
- `local_logs`
- `local_site_info`
- `list_site_files`
- `read_site_file`
- `search_site_files`
- `write_site_file`
- `delete_site_file`
- `execute_wp_cli`
- `wp_call_function`
- `wp_call_static_method`
- `execute_wp_php_readonly`
- `execute_wp_php`
- `mysql_query`
- `mysql_execute`
- `mysql_schema`
- `db_export`
- `db_import`
- `backup_site`
- `list_backups`
- `delete_backup`
- `cleanup_backups`
- `preview_restore_backup`
- `restore_backup`

### MCP Resources

- `localwp://sites`
- `localwp://sites/{siteName}/summary`
- `localwp://sites/{siteName}/doctor`
- `localwp://sites/{siteName}/logs`

### MCP Prompts

- `diagnose_local_site`
- `restore_local_site`

## Platform Support

`localwp-mcp` is designed for:

- macOS
- Windows
- Linux

It supports both current Local `lightning-services` layouts and older `site-binaries` layouts.

Live validation has been completed on:

- macOS
- Windows

Linux support is implemented in the code paths and tests, but has not yet been live-validated on a machine with LocalWP.

## Useful Environment Variables

Most users only need these:

- `LOCALWP_MCP_PROFILE`
- `LOCAL_SITE_NAME`
- `LOCAL_SITE_ID`
- `LOCALWP_MCP_BACKUPS_DIR`

Advanced override variables also exist for custom Local layouts, but most installations do not need them.

## Troubleshooting

If the MCP does not find your site or cannot run WP-CLI/MySQL:

1. Start the site in Local.
2. Run `local_environment_check`.
3. Run `local_doctor`.
4. Check `local_logs`.

Those tools are the fastest way to see whether the problem is:

- site selection
- Local metadata resolution
- WP-CLI resolution
- MySQL connectivity
- missing or stopped Local services

If plain shell `wp` behaves differently from MCP, call `local_site_info`.

`local_site_info` now includes `wpCliRuntime`, `mysqlRuntime`, and `shellReproduction` sections that show the exact Local-managed binaries, working directory, environment overrides, and command arrays this MCP uses. MCP does not rely on your ambient shell `wp`; it resolves the selected site's Local runtime directly.

## For Contributors

Contributor and maintainer docs live outside the main user guide:

- [CONTRIBUTING.md](https://github.com/kazimshah39/localwp-mcp/blob/main/CONTRIBUTING.md)
- [SECURITY.md](https://github.com/kazimshah39/localwp-mcp/blob/main/SECURITY.md)
- [Maintainer Docs](https://github.com/kazimshah39/localwp-mcp/blob/main/docs/maintainers/README.md)
