# localwp-mcp

`localwp-mcp` is an MCP server for LocalWP projects.

It discovers Local sites from Local's own metadata, resolves the correct Local PHP and MySQL runtimes for each site, and gives AI agents simple access to:

- Local site discovery
- Local logs and doctor-style diagnostics
- site-aware WP-CLI
- safe SQL reads
- full SQL access when you opt into it
- database export/import
- Local-friendly backups
- restore workflows
- machine-readable Local diagnostics
- MCP resources and prompts

## Project Docs

- [Contributing](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Release Checklist](./docs/RELEASE_CHECKLIST.md)
- [Windows Test Handoff](./docs/WINDOWS_TEST_HANDOFF.md)

## Profiles

The package now has only 2 profiles:

- `safe`
  Good default. Read-focused SQL plus safe WP-CLI inspection commands.
- `full-access`
  Best for local development when you want the agent to fully work on the site and database.

`safe` is the default.

## Tools

- `list_local_sites`
- `local_environment_check`
- `local_doctor`
- `local_logs`
- `local_site_info`
- `backup_site`
- `db_export`
- `db_import`
- `restore_backup`
- `mysql_query`
  Safe profile SQL reads only.
- `mysql_execute`
  Full-access profile single-statement SQL execution.
- `mysql_schema`
  Accepts `table` and also `tableName` as a compatibility alias.
- `execute_wp_cli`

## Quick Setup

### npm

Once published, the simplest MCP config is:

```json
{
  "mcpServers": {
    "localwp": {
      "command": "npx",
      "args": ["localwp-mcp"],
      "env": {
        "LOCAL_SITE_NAME": "example-site",
        "LOCALWP_MCP_PROFILE": "full-access"
      }
    }
  }
}
```

If you want the cautious default instead, set:

```json
{
  "LOCALWP_MCP_PROFILE": "safe"
}
```

After a global install, you can also use:

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

### From Source

If you are running from a local clone:

```bash
pnpm install
pnpm build
```

Then point your MCP client at the built entrypoint:

```json
{
  "mcpServers": {
    "localwp": {
      "command": "node",
      "args": [
        "/path/to/localwp-mcp/dist/index.js"
      ],
      "env": {
        "LOCAL_SITE_NAME": "example-site",
        "LOCALWP_MCP_PROFILE": "full-access"
      }
    }
  }
}
```

## Recommended First Command

Run `local_environment_check` or `local_doctor` first on any machine. They show:

- resolved Local metadata paths
- resolved Local app-resource paths
- WP-CLI/tooling resolution
- optional WP-CLI and MySQL probes for a selected site
- log availability and practical next steps

That makes support and cross-platform debugging much easier.

## Backups and Database Transfers

- `backup_site`
  Creates a backup folder for the selected site.
- `backup_site` with `scope=database`
  Creates a timestamped backup folder with a fresh SQL dump.
- `backup_site` with `scope=full`
  Copies the site's `app`, `conf`, and `logs` directories and writes a fresh SQL dump into `app/sql`.
- `db_export`
  Writes a SQL file directly. Good when you only want the database.
- `db_import`
  Imports either a `.sql` file or a `backup_site` directory. Requires `full-access`.
- `restore_backup`
  Restores from a `.sql` file or a `backup_site` directory. In `full-access`, it can also restore `app`, `conf`, and `logs` from a full backup.

The full backup is intentionally folder-based instead of shelling out to platform-specific `zip` or `tar` commands. That keeps the MCP predictable across macOS, Windows, and Linux, and it stays close to Local's own site-folder restore shape.

## Resources and Prompts

This MCP now also exposes lightweight resources and prompts:

- Resource: `localwp://sites`
  JSON catalog of discovered Local sites.
- Resource template: `localwp://sites/{siteName}/summary`
  Per-site Local resolution summary.
- Resource template: `localwp://sites/{siteName}/doctor`
  Per-site doctor output.
- Resource template: `localwp://sites/{siteName}/logs`
  Per-site recent logs.
- Prompt: `diagnose_local_site`
  Helps an agent diagnose a LocalWP site with the MCP tools.
- Prompt: `restore_local_site`
  Helps an agent restore a site from a SQL dump or backup directory.

## Platform Compatibility

- `macOS`
  Uses Local metadata under `~/Library/Application Support/Local` and the standard Local app bundle resources.
- `Windows`
  Uses Local metadata under `%APPDATA%\\Local` and searches both per-user and `Program Files` installs for Local resources.
- `Linux`
  Uses Local metadata under `~/.config/Local` and the common `/opt/Local/resources/extraResources` install path.

The resolver supports both current `lightning-services` layouts and older `site-binaries` layouts.

## Configuration

Optional environment variables:

- `LOCALWP_MCP_PROFILE`
  `safe` or `full-access`
- `LOCALWP_MCP_BACKUPS_DIR`
  Optional shared backup directory. If omitted, backups are written under each Local site's `localwp-mcp-backups` folder.
- `LOCAL_SITE_NAME`
- `LOCAL_SITE_ID`
- `LOCAL_APP_SUPPORT_DIR`
- `LOCAL_EXTRA_RESOURCES_DIRS`
- `LOCAL_RUN_DIR`
- `LOCAL_LIGHTNING_SERVICES_DIR`
- `LOCAL_LIGHTNING_SERVICES_DIRS`
- `LOCAL_SITES_JSON`
- `LOCAL_SITE_STATUSES_JSON`
- `LOCAL_WP_CLI_PHAR`
- `LOCAL_WP_CLI_CONFIG`
- `LOCAL_HELPER_BIN_DIRS`
- `LOCAL_MYSQL_HOST`

## Why It Stays Simple

- plain TypeScript
- `pnpm`
- `tsc`
- stdio transport

There is no bundler here because this is a Node MCP server and the simpler build is easier to debug and maintain.

## Development

```bash
pnpm install
pnpm check
pnpm test
pnpm build
node dist/index.js
```

For contribution and release workflows, see:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [docs/RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md)
