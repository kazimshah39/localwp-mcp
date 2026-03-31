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
      "args": ["localwp-mcp"],
      "env": {
        "LOCALWP_MCP_PROFILE": "safe"
      }
    }
  }
}
```

You can also install it globally:

```bash
npm install -g localwp-mcp
```

Then use:

```json
{
  "mcpServers": {
    "localwp": {
      "command": "localwp-mcp",
      "env": {
        "LOCALWP_MCP_PROFILE": "safe"
      }
    }
  }
}
```

If you want the MCP to focus on one site by default, set:

```json
{
  "LOCAL_SITE_NAME": "example-site"
}
```

## Access Modes

`localwp-mcp` has 2 access modes:

- `safe`
  Best default for most people. Safe WordPress inspection commands, diagnostics, logs, database reads, and backup/export flows.
- `full-access`
  Best when you want the agent to fully work on your local site, including SQL writes, imports, and restore operations.

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

Examples:

- list plugins
- inspect options
- list posts or users
- run plugin-specific WP-CLI commands

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
- `db_export`
- `db_import`
- `restore_backup`

`backup_site` supports:

- `database`
- `full`

The `full` backup format is folder-based and includes the site's `app`, `conf`, and `logs` directories plus a fresh SQL dump.

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
- `mysql_query`
- `mysql_execute`
- `mysql_schema`
- `db_export`
- `db_import`
- `backup_site`
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

## For Contributors

Contributor and maintainer docs live outside the main user guide:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [Maintainer Docs](./docs/maintainers/README.md)
