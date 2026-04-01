# Windows Validation Report

Date: 2026-04-01

## Executive Summary

This report captures a full end-to-end Windows validation of `localwp-mcp` against a real LocalWP installation and a real LocalWP site on this machine.

The validation was not limited to unit tests. The built stdio MCP server at `dist/index.js` was launched and exercised through a real MCP SDK client. Both access profiles were validated:

- `safe`
- `full-access`

The final result is positive:

- static checks passed
- live stdio MCP validation passed
- both access profiles behaved correctly
- backup, export, import, restore, inventory, cleanup, resources, and prompts all worked
- `restore_backup` with `restoreFiles: true` was explicitly verified on disk on Windows and worked correctly

One real issue was found during the live run:

- the server reported version `0.1.0` when started directly via `node dist/index.js`

That issue was fixed in code, covered by tests, and revalidated live. No push or publish action was taken.

## Goal Of This Run

The goal of this Windows validation was to answer, with real evidence, whether the current `localwp-mcp` repo is solid on Windows against a real LocalWP setup.

In particular, this run was intended to validate:

- repo health after a fresh clone
- the current MCP tool, resource, and prompt surface
- the real stdio server, not just direct module calls
- Local site discovery and lifecycle control
- WP-CLI access
- MySQL read and write access
- site-scoped file access
- logs and doctor tooling
- backup, export, import, restore, inventory, and cleanup flows
- enforcement of `safe` profile restrictions
- enforcement and capability of `full-access`
- whether full file restoration during `restore_backup` truly works on Windows

## Environment

| Item | Value |
| --- | --- |
| Repo path | `D:\Projects\localwp-mcp` |
| Operating system | Windows |
| Current date used for the run | 2026-04-01 |
| Node | `v24.14.1` |
| pnpm | `10.32.1` |
| LocalWP metadata root | `%APPDATA%\Local` |
| Local site used | `test-1` |
| Local site id | `EwDTDVg-o` |
| Site path | `C:\Users\Nawaz\Local Sites\test-1` |
| Local version | `9.2.3+6776` |
| PHP runtime resolved by MCP | `8.2.23` |
| MySQL runtime resolved by MCP | `8.0.35` |
| Validation method | Real MCP stdio server at `dist/index.js`, exercised via MCP SDK client |

## Repo State And Surface At Start

The repo was clean at the start of this run.

The built stdio server exposed the following live surface during validation:

- 24 tools
- 58 concrete resources on this machine
- 3 resource templates
- 2 prompts

### Tools Present

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
- `backup_site`
- `list_backups`
- `delete_backup`
- `cleanup_backups`
- `db_export`
- `db_import`
- `restore_backup`
- `mysql_query`
- `mysql_execute`
- `mysql_schema`
- `execute_wp_cli`

### Resource Templates Present

- `localwp://sites/{siteName}/summary`
- `localwp://sites/{siteName}/doctor`
- `localwp://sites/{siteName}/logs`

### Prompts Present

- `diagnose_local_site`
- `restore_local_site`

## Static Verification

The following commands were run from `D:\Projects\localwp-mcp`:

```powershell
pnpm install
pnpm check
pnpm test
pnpm build
```

Results:

- `pnpm install` passed
- `pnpm check` passed
- `pnpm test` passed
- `pnpm build` passed

Before the code fix in this run, the test suite was already green.

After the code fix in this run, the verification was repeated and the final result was:

- 52 tests passed
- 0 tests failed

## LocalWP Discovery On Windows

Local metadata resolution worked correctly from `%APPDATA%\Local`.

Confirmed readable metadata files:

- `%APPDATA%\Local\sites.json`
- `%APPDATA%\Local\site-statuses.json`
- `%APPDATA%\Local\graphql-connection-info.json`

The MCP successfully discovered 19 Local sites on this machine.

The selected validation target was:

- site name: `test-1`
- site id: `EwDTDVg-o`
- domain: `test-1.local`
- path: `C:\Users\Nawaz\Local Sites\test-1`

## Real Stdio MCP Validation Method

This validation did not use direct module imports as the primary proof.

The real server was launched like this:

```powershell
node .\dist\index.js
```

A real MCP SDK client connected over stdio and exercised:

- `listTools`
- `callTool`
- `listResources`
- `listResourceTemplates`
- `readResource`
- `listPrompts`
- `getPrompt`

This matters because it validates the actual user-facing entrypoint and transport behavior on Windows, not just internal helper functions.

## Safe Profile Validation

Environment used for the safe profile run:

```powershell
$env:LOCALWP_MCP_PROFILE = "safe"
$env:LOCAL_SITE_NAME = "test-1"
$env:LOCALWP_MCP_BACKUPS_DIR = "C:\Users\Nawaz\AppData\Local\Temp\localwp-mcp-safe-pre"
```

### Safe Profile Operations That Passed

- `list_local_sites`
- `start_local_site`
- `stop_local_site`
- `restart_local_site`
- `local_site_info`
- `local_environment_check`
- `local_doctor`
- `local_logs`
- `list_site_files`
- `read_site_file`
- `search_site_files`
- `execute_wp_cli plugin list --format=json`
- `execute_wp_cli search-replace test-1.local validation-test-1.local --dry-run`
- `mysql_query`
- `mysql_schema`
- `mysql_schema` using the backward-compatible `tableName` alias
- `db_export`
- `backup_site` with `scope=database`
- `backup_site` with `scope=full`
- `list_backups`
- resource listing
- resource reads
- prompt listing
- prompt retrieval

### Safe Profile Restrictions That Were Enforced Correctly

Blocked correctly:

- `mysql_execute`
- `db_import`
- `restore_backup`
- `delete_backup`
- `cleanup_backups`
- `write_site_file`
- `delete_site_file`
- `execute_wp_cli plugin activate ...`
- live `execute_wp_cli search-replace ...` without `--dry-run`
- `execute_wp_cli eval ...`

Representative results:

- `mysql_execute` returned the expected `full-access` requirement error
- `db_import` returned the expected `full-access` requirement error
- `restore_backup` returned the expected `full-access` requirement error
- WP-CLI write operations were rejected in `safe`
- arbitrary-code-like WP-CLI usage such as `eval` was blocked

### Safe Profile Notes

The first pass initially looked like `local_environment_check` had failed, but that turned out to be a validation-harness assumption, not a product bug. The payload correctly reports the resolved site under `siteContext.site`, not a top-level `site` field.

After correcting the assertion, `local_environment_check` passed in `safe` with:

- `siteContext.site.name = test-1`
- successful WP-CLI probe
- successful MySQL probe

## Full-Access Profile Validation

Environment used for the main full-access run:

```powershell
$env:LOCALWP_MCP_PROFILE = "full-access"
$env:LOCAL_SITE_NAME = "test-1"
$env:LOCALWP_MCP_BACKUPS_DIR = "C:\Users\Nawaz\AppData\Local\Temp\localwp-mcp-full-20260401-live"
```

### Full-Access Operations That Passed

- `list_local_sites`
- `start_local_site`
- `stop_local_site`
- `restart_local_site`
- `local_site_info`
- `local_environment_check`
- `local_doctor`
- `local_logs`
- `list_site_files`
- `read_site_file`
- `search_site_files`
- `write_site_file`
- `delete_site_file`
- `execute_wp_cli plugin list --format=json`
- WP-CLI write flow by creating a temporary draft post and deleting it
- `mysql_query`
- `mysql_schema`
- `mysql_execute`
- MySQL write flow by creating and dropping a temporary table
- `db_export`
- `db_import`
- `backup_site` with `scope=database`
- `backup_site` with `scope=full`
- `list_backups`
- `delete_backup`
- `cleanup_backups`
- `restore_backup` from a database backup
- `restore_backup` from a full backup
- `local_doctor` after restore
- resource reads
- prompt retrieval

### Full-Access Write Path Details

#### Site File Write/Delete

The MCP successfully:

- created `app/public/wp-content/localwp-mcp-validation/write-smoke.txt`
- verified it existed on disk
- deleted it
- verified it was removed on disk

#### WP-CLI Write Validation

The MCP successfully:

- listed plugins with `plugin list --format=json`
- created a temporary draft post through WP-CLI
- received a numeric post id
- deleted the draft post successfully

During the observed run, the temporary draft post id was `6`.

#### MySQL Write Validation

The MCP successfully:

- dropped any previous `localwp_mcp_exec_smoke` table
- created `localwp_mcp_exec_smoke`
- verified the table existed
- dropped the table again
- verified it no longer existed

## Backup, Export, Import, Restore, Inventory, And Cleanup Validation

### SQL Export

`db_export` worked in both profile-appropriate scenarios.

Example validated export path:

- `C:\Users\Nawaz\AppData\Local\Temp\localwp-mcp-full-20260401-live\test-1-20260401-170139-full-export.sql`

The SQL file was confirmed to exist on disk and have non-zero size.

### Database Backup

`backup_site` with `scope=database` worked.

Validated on disk:

- backup directory exists
- `manifest.json` exists
- SQL dump exists

Example validated directory:

- `C:\Users\Nawaz\AppData\Local\Temp\localwp-mcp-full-20260401-live\test-1-database-20260401-170139-full-db`

### Full Backup

`backup_site` with `scope=full` worked.

Validated on disk:

- backup directory exists
- `manifest.json` exists
- copied `app` exists
- copied `conf` exists
- copied `logs` exists
- SQL dump inside the full backup exists

Example validated full backup directory:

- `C:\Users\Nawaz\AppData\Local\Temp\localwp-mcp-full-20260401-live\test-1-full-20260401-170139-restore-file-test`

Validated SQL dump inside the full backup:

- `C:\Users\Nawaz\AppData\Local\Temp\localwp-mcp-full-20260401-live\test-1-full-20260401-170139-restore-file-test\app\sql\test-1-backup.sql`

### Backup Inventory

`list_backups` worked and returned managed backup artifacts with the expected relative paths.

Confirmed artifacts included:

- the database backup directory
- the full backup directory
- the export artifact

### Delete Backup

`delete_backup` worked in `full-access`.

It successfully removed the targeted managed backup directory on disk.

### Cleanup Backups

`cleanup_backups` worked in `full-access`.

One validation nuance mattered here:

- a root-level `.sql` export is categorized as `sql_file`
- an export stored under the managed `database-exports` directory is categorized as `database_export`

After correcting the validation to target a real `database_export` artifact, the flow passed:

- dry-run identified the export artifact
- real cleanup deleted it
- on-disk deletion was confirmed

### DB Import

`db_import` worked in `full-access`.

A lightweight smoke SQL file was created and imported. It:

- created `localwp_mcp_import_smoke`
- inserted one row
- returned a pre-import backup path

The pre-import backup file was confirmed on disk.

Example pre-import backup path:

- `C:\Users\Nawaz\AppData\Local\Temp\localwp-mcp-full-20260401-live\pre-import\test-1-before-import-20260401-170142.sql`

## Explicit Windows Test: `restore_backup` With `restoreFiles: true`

This was the highest-risk Windows-specific item from the handoff and it was tested explicitly.

### Test Procedure

1. A known sentinel file was created inside the site before the full backup:
   `app/public/wp-content/localwp-mcp-validation/restore-sentinel.txt`
2. A full backup was created through the real MCP server.
3. After the backup, the sentinel file content was changed.
4. After the backup, an extra file was created:
   `app/public/wp-content/localwp-mcp-validation/restore-extra.txt`
5. `restore_backup` was run through the real stdio MCP server with:
   - `restoreFiles: true`
   - `replaceDirectories: true`
6. Verification was done on disk, not just through MCP response payloads.

### What Was Verified On Disk

Verified after restore:

- the sentinel file content reverted to the original pre-backup value
- the extra file was removed from disk

### Observed Result

The full restore returned:

- `restoredFiles = ["app", "conf", "logs"]`
- a valid pre-restore backup directory

On disk:

- the sentinel file content reverted correctly
- the extra file no longer existed

This is the key conclusion of the Windows run:

`restore_backup` with file restoration enabled truly works on Windows in the current repo state.

## Database Restore Validation Notes

Database restore behavior was also validated, but it is important to state the semantics correctly.

A SQL-based restore does revert backed-up database state. It should not be expected to delete arbitrary out-of-band tables that were never present in the backup.

To validate this correctly, a follow-up proof run used an existing table workflow:

1. created `localwp_mcp_restore_verify`
2. inserted a known row value
3. created a database backup
4. mutated the row value
5. restored from the database backup
6. verified the row value reverted to the original value

That corrected validation passed.

This means:

- database restore is working as expected
- the earlier assumption that it should delete unrelated newly created tables was too strict

## Resources And Prompts

### Resources Validated

- `localwp://sites`
- `localwp://sites/test-1/summary`
- `localwp://sites/test-1/doctor`
- `localwp://sites/test-1/logs`

These were successfully listed and read through the live MCP client.

### Prompts Validated

- `diagnose_local_site`
- `restore_local_site`

Both were successfully listed and retrieved through the live MCP client.

## Windows-Specific Observations

### Things That Worked Well On Windows

- Local metadata resolution from `%APPDATA%\Local`
- site discovery from `sites.json` and `site-statuses.json`
- Local lightning-service binary resolution
- PHP binary resolution
- MySQL binary resolution
- WP-CLI execution using the Local-managed runtime
- MySQL access over Windows TCP mode
- site lifecycle control through Local start/stop/restart
- file-copy behavior during full backup and full restore
- site-scoped file operations

Resolved runtime example paths observed during validation:

- PHP:
  `C:\Users\Nawaz\AppData\Roaming\Local\lightning-services\php-8.2.23+0\bin\win64\php.exe`
- MySQL:
  `C:\Users\Nawaz\AppData\Roaming\Local\lightning-services\mysql-8.0.35+2\bin\win64\bin\mysql.exe`

### Important Validation Nuances For Future Maintainers

- `local_environment_check` reports the selected site under `siteContext.site`
- SQL restore should be validated by checking that backed-up state is restored, not by assuming unrelated later-created tables will disappear
- `cleanup_backups` category checks should use the correct artifact category:
  - `database_export` for managed exports under `database-exports`
  - `sql_file` for standalone root-level `.sql` files

## Real Issue Found And Fixed

One real issue was found during live stdio validation.

### Problem

When the server was started directly with:

```powershell
node .\dist\index.js
```

it reported version `0.1.0` instead of the package version `0.1.4`.

This happened because `npm_package_version` is not reliably present when the built file is started directly outside an npm script context.

### Fix

The server now resolves its version like this:

1. use `process.env.npm_package_version` when present
2. otherwise read the version from `package.json`
3. only fall back to `0.1.0` as a hard safety default

Changed file:

- [src/server.ts](D:/Projects/localwp-mcp/src/server.ts#L13)

Regression test added:

- [tests/server.test.ts](D:/Projects/localwp-mcp/tests/server.test.ts#L1)

### Revalidation After Fix

After the fix:

- `pnpm check` passed
- `pnpm test` passed
- `pnpm build` passed
- the live stdio server reported version `0.1.4`

## Files Changed During This Work

- [src/server.ts](D:/Projects/localwp-mcp/src/server.ts#L1)
- [tests/server.test.ts](D:/Projects/localwp-mcp/tests/server.test.ts#L1)
- [docs/maintainers/windows-validation-report-2026-04-01.md](D:/Projects/localwp-mcp/docs/maintainers/windows-validation-report-2026-04-01.md#L1)

## What Passed

Passed in the final state:

- fresh-clone static repo verification
- real stdio MCP boot on Windows
- tool listing
- resource listing and reading
- prompt listing and retrieval
- site discovery
- site start/stop/restart
- Local environment inspection
- Local doctor
- log collection
- site file list/read/search
- site file write/delete in `full-access`
- WP-CLI read commands
- WP-CLI write commands in `full-access`
- MySQL read queries
- MySQL schema inspection
- MySQL write execution in `full-access`
- `db_export`
- `db_import`
- `backup_site` with `scope=database`
- `backup_site` with `scope=full`
- `list_backups`
- `delete_backup`
- `cleanup_backups`
- `restore_backup` from database backup
- `restore_backup` from full backup
- explicit file restoration verification on disk for Windows
- `safe` profile restriction enforcement

## What Failed

No product failures remained at the end of the run.

The only actual code issue discovered during live Windows validation was the stdio server version-reporting bug, and that was fixed.

Some early failures during validation were due to test-harness assumptions rather than MCP defects:

- incorrect assumption about `local_environment_check` payload shape
- incorrect assumption about SQL restore semantics
- incorrect assumption about `cleanup_backups` artifact category in one test

## Final Assessment

This package is now in good shape on Windows based on a real LocalWP validation run.

The strongest release-relevant conclusion from this work is:

- the current `localwp-mcp` repo works end to end on a real Windows LocalWP setup
- the main high-risk Windows restore scenario has been tested for real
- `restore_backup` with `restoreFiles: true` and `replaceDirectories: true` truly works on Windows
- the only code issue found in this run was fixed and retested

## Scope Limits

This report is strong evidence for Windows readiness, but it is still one-machine validation. The following were not covered in this specific run:

- a second independent Windows machine
- Node `20.x` specifically, even though the package target is `>=20`
- Local multisite validation
- legacy Local layouts outside the currently resolved lightning-services layout
- packaged `npm pack` install validation

Those are release-hardening opportunities, not blockers from this run.

## Final Status

Windows validation status: pass

`restore_backup` file restoration on Windows: confirmed working on disk

Package status on Windows: solid based on the scope of this live validation

Push or publish status: not performed
