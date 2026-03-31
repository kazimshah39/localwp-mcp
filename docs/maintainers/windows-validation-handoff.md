# Windows Validation Handoff

This file is for the next chat session on a Windows laptop.

The goal is to validate that `localwp-mcp` works end-to-end on Windows with a real LocalWP site, not just unit tests.

## Current Status

- Repo: `localwp-mcp`
- Package manager: `pnpm`
- Runtime: Node `>= 20`
- Profiles:
  - `safe`
  - `full-access`
- Current feature surface:
  - `13` tools
  - `22` resources
  - `2` prompts
- Live-tested successfully on macOS against a real LocalWP site.
- Already verified on macOS:
  - `pnpm check`
  - `pnpm test`
  - `pnpm build`
  - real MCP stdio integration
  - real WP-CLI access
  - real MySQL access
  - `db_export`
  - `db_import`
  - `backup_site`
  - `restore_backup`

## Important Known Detail

One compatibility issue was found during deep testing and already fixed:

- `mysql_schema` now accepts both `table` and `tableName`

If Windows testing fails around schema inspection, first confirm the current code still includes that alias support in:

- `src/tools/mysql-schema.ts`

## What Must Be Tested On Windows

Do not stop at `pnpm test`.

The Windows test must cover:

1. Static verification
2. Real LocalWP site discovery
3. Real WP-CLI execution
4. Real MySQL execution
5. Safe profile restrictions
6. Full-access profile permissions
7. Backup/export/import/restore flows
8. MCP resources
9. MCP prompts

## Tool Inventory To Validate

These tools should be present:

- `list_local_sites`
- `local_environment_check`
- `local_site_info`
- `local_logs`
- `local_doctor`
- `execute_wp_cli`
- `mysql_query`
- `mysql_execute`
- `mysql_schema`
- `db_export`
- `db_import`
- `backup_site`
- `restore_backup`

## Resources To Validate

At minimum, these should be listed and readable:

- `localwp://sites`
- `localwp://sites/{siteName}/summary`
- `localwp://sites/{siteName}/doctor`
- `localwp://sites/{siteName}/logs`

## Prompts To Validate

- `diagnose_local_site`
- `restore_local_site`

## Windows Preconditions

Before running the full test:

- Install Node `20+`
- Install `pnpm`
- Install LocalWP for Windows
- Start at least one LocalWP site
- Know the Local site name, or be ready to read it from `list_local_sites`

Use any running LocalWP site on Windows and substitute that site name everywhere below.

## Windows Paths Worth Checking If Something Fails

The code tries to support standard Windows Local paths. If Windows integration fails, inspect these first:

- `%APPDATA%\Local\sites.json`
- `%APPDATA%\Local\site-statuses.json`
- `%LOCALAPPDATA%\Programs\Local`
- `C:\Program Files\Local`

The Windows test should confirm the MCP resolves the Local metadata and the Local service binaries correctly.

## Recommended Test Order

### 1. Install And Build

Run:

```powershell
pnpm install
pnpm check
pnpm test
pnpm build
```

Expected result:

- all commands succeed

### 2. Verify The Server Boots

Run:

```powershell
node .\dist\index.js
```

Expected result:

- the stdio server boots cleanly
- no immediate crash

### 3. Pick A Real Site

Use a real LocalWP site.

If needed, start by listing sites through MCP and pick a running one.

For the rest of the checklist below, replace `example-site` with the actual Windows site name.

### 4. Safe Profile Test

Set environment variables:

```powershell
$env:LOCALWP_MCP_PROFILE = "safe"
$env:LOCAL_SITE_NAME = "example-site"
$env:LOCALWP_MCP_BACKUPS_DIR = Join-Path $env:TEMP "localwp-mcp-safe-pre"
```

Then validate all of the following through the real MCP stdio server:

- `list_local_sites`
- `local_site_info`
- `local_environment_check`
- `local_doctor`
- `local_logs`
- `execute_wp_cli` with a safe read command like `plugin list --format=json`
- `execute_wp_cli` with `search-replace --dry-run`
- `mysql_query`
- `mysql_schema`
- `db_export`
- `backup_site` with `scope=database`
- `backup_site` with `scope=full`
- resource listing
- resource reads
- prompt listing
- prompt retrieval

These actions should be blocked in `safe`:

- `mysql_execute`
- `db_import`
- `restore_backup`
- `execute_wp_cli` write commands like `plugin activate`
- live `search-replace`
- `execute_wp_cli eval`

### 5. Full-Access Profile Test

Set environment variables:

```powershell
$env:LOCALWP_MCP_PROFILE = "full-access"
$env:LOCAL_SITE_NAME = "example-site"
$env:LOCALWP_MCP_BACKUPS_DIR = Join-Path $env:TEMP "localwp-mcp-full-pre"
```

Then validate all of the following through the real MCP stdio server:

- `list_local_sites`
- `local_site_info`
- `local_environment_check`
- `local_doctor`
- `local_logs`
- `execute_wp_cli plugin list --format=json`
- `execute_wp_cli` write path:
  - create a temporary draft post
  - delete that post
- `mysql_query`
- `mysql_schema`
- `mysql_execute`
  - create a temporary table
  - drop that table
- `db_export`
- `db_import`
  - use a lightweight SQL smoke file
- `backup_site` with `scope=database`
- `backup_site` with `scope=full`
- `restore_backup` from a database backup
- `restore_backup` from a full backup
- run `local_doctor` again after restore
- resource listing and reads
- prompt listing and retrieval

### 6. Artifact Validation

Do not trust only tool success responses.

Also check that the generated files and folders exist on disk:

- exported `.sql` files
- backup directories
- `manifest.json`
- copied `app`
- copied `conf`
- copied `logs`
- SQL dump inside full backup

For a full backup, verify the backup directory contains at least:

- `app`
- `conf`
- `logs`
- `manifest.json`

## What The Next Chat Should Report Back

The Windows test report should include:

- the Local site used
- whether Local metadata resolution worked
- whether WP-CLI worked
- whether MySQL worked
- whether `safe` restrictions were enforced correctly
- whether `full-access` actions succeeded
- whether backup/export/import/restore succeeded
- whether resources and prompts worked
- any Windows-specific path issues or Local binary resolution issues

## Strong Recommendation For The Windows Chat

The next chat should use a real MCP stdio integration harness, not only direct module imports.

The server entrypoint is:

- `dist/index.js`

The next chat should:

1. build the project
2. launch the real server via stdio
3. connect with the MCP SDK client
4. call every tool, resource, and prompt listed above
5. verify generated artifacts on disk

## If Something Breaks On Windows

Focus first on:

- Local metadata path resolution
- Local service binary discovery
- MySQL socket vs TCP behavior on Windows
- path separators in backup and restore flows
- file copy behavior during full backup and restore

Relevant code areas:

- `src/platform-paths.ts`
- `src/local-sites.ts`
- `src/local-tooling.ts`
- `src/mysql.ts`
- `src/backup.ts`

## Final Goal

After the Windows run, we want to be able to say:

- macOS live-tested
- Windows live-tested
- Linux covered by code paths, tests, and CI

That will put this MCP in a much stronger position for public release.
