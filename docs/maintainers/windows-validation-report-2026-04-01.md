# Windows Validation Report

Date: 2026-04-01

## Summary

This report captures a full real Windows validation of `localwp-mcp` against a real LocalWP site on this machine.

The validation was run against:

- Repo: `D:\Projects\localwp-mcp`
- OS: Windows
- Node: `v24.14.1`
- `pnpm`: `10.32.1`
- Local site used: `test-1`
- Local site status during validation: started running, then repeatedly stopped/started/restarted as part of the test plan
- Validation method: real MCP stdio server via `dist/index.js` and a real MCP SDK client

This was not just a unit-test pass. The MCP was exercised end to end against the actual LocalWP installation and the actual site files, MySQL runtime, Local metadata, and Local lifecycle controls on Windows.

## Overall Verdict

Windows validation passed after a small set of Windows-specific fixes.

At the end of the work:

- `pnpm install` passed
- `pnpm check` passed
- `pnpm test` passed
- `pnpm build` passed
- all 21 MCP tools were revalidated on Windows
- resources were validated
- prompts were validated
- `safe` profile restrictions were validated
- `full-access` profile write paths were validated
- backup, export, import, database restore, and full restore flows were validated on Windows

## What Was Good

These areas worked correctly in the final Windows run:

- Local metadata resolution from `%APPDATA%\Local`
- discovery of 19 Local sites on this machine
- explicit site selection for `test-1`
- Local runtime resolution for PHP, MySQL, and WP-CLI
- site lifecycle control through Local start, stop, and restart actions
- site-scoped file listing, reading, searching, writing, and deleting
- WP-CLI read commands
- WP-CLI write commands in `full-access`
- MySQL read queries
- MySQL write execution in `full-access`
- table/schema inspection through `mysql_schema`
- log collection for both site logs and Local global logs
- doctor and environment checks
- SQL export
- SQL import
- database-only backup
- full backup with copied `app`, `conf`, `logs`, plus SQL dump
- restore from database backup
- restore from full backup
- post-restore health verification
- resource listing and resource reads
- prompt listing and prompt retrieval

## What Was Not Good Initially

Several Windows-specific issues appeared during the first live validation pass:

### 1. MCP-facing site file paths were not stable across platforms

On Windows, site-relative paths were being returned with backslashes instead of forward slashes.

Symptoms:

- Windows tests failed in `tests/site-files.test.ts`
- returned `relativePath` values looked like `app\\public\\index.php`
- tests and MCP consumers expected `app/public/index.php`

Impact:

- cross-platform inconsistency in the MCP response surface
- unnecessary Windows-only failures

Status:

- fixed

### 2. Windows Local site paths stored as `~\...` were not expanded correctly

Local stores site paths like `~\Local Sites\test-1` in Windows metadata.

Symptoms:

- site resolution failed with `Local site path is not readable: ~\Local Sites\test-1`
- file access, site context building, and other site-scoped operations could not proceed

Impact:

- blocked nearly all real site operations on Windows

Status:

- fixed

### 3. Local Lightning service binaries used multiple real layouts on Windows

The initial resolver assumed the executable would always be under `bin\<platform>\bin\<exe>`.

What Windows actually used on this machine:

- PHP: `...\php-8.2.23+0\bin\win64\php.exe`
- MySQL: `...\mysql-8.0.35+2\bin\win64\bin\mysql.exe`

Symptoms:

- PHP executable resolution failed even though the package existed
- site context building and all runtime-backed tools failed

Impact:

- blocked WP-CLI, MySQL, doctor, logs, site info, and backup flows

Status:

- fixed

### 4. WP-CLI JSON output on Windows was polluted by a PHP `imagick` startup warning

Local’s PHP runtime on Windows expects ImageMagick and Ghostscript-related environment setup.

Symptoms:

- `execute_wp_cli plugin list --format=json` produced startup warning text before JSON
- JSON consumers broke because stdout was no longer clean JSON

Impact:

- machine-readable WP-CLI output was unreliable on Windows
- validation harness and downstream MCP clients would have trouble with JSON-oriented WP-CLI commands

Status:

- fixed

## Code Changes Made

### [src/site-files.ts](../../src/site-files.ts)

Changed:

- normalized MCP-facing site-relative paths to use `/` regardless of OS path separator

Why:

- the filesystem can stay Windows-native internally
- the MCP response surface should remain stable and cross-platform

### [src/local-sites.ts](../../src/local-sites.ts)

Changed:

- expanded both `~/...` and `~\...` home-relative site paths
- improved service binary lookup to support multiple Lightning service layouts on Windows

Why:

- Windows Local metadata uses backslash-form home-relative site paths
- Local service packages on Windows do not all use the same internal executable layout

### [src/platform-paths.ts](../../src/platform-paths.ts)

Changed:

- added helper logic to generate Lightning service binary candidates for both direct and nested `bin` layouts

Why:

- Windows PHP and MySQL service packages used different real layouts on this machine

### [src/wp-cli.ts](../../src/wp-cli.ts)

Changed:

- aligned the WP-CLI execution environment with Local’s Windows PHP service expectations
- added ImageMagick and Ghostscript-related env setup used by Local’s own PHP service

Why:

- this removed the Windows `php_imagick.dll` startup warning from WP-CLI stdout
- JSON-producing WP-CLI commands became reliable again

### [tests/platform-paths.test.ts](../../tests/platform-paths.test.ts)

Changed:

- added test coverage for Lightning service binary candidate generation

Why:

- protects the Windows service-layout fix from regressing

### [tests/local-sites.test.ts](../../tests/local-sites.test.ts)

Added:

- coverage for home-path expansion using both slash styles

Why:

- protects the Windows Local metadata path fix from regressing

## Final Validation Results

## Static Checks

Passed:

- `pnpm install`
- `pnpm check`
- `pnpm test`
- `pnpm build`

Final unit-test result:

- 47 tests passed
- 0 failed

## Tool Surface Validated

The following tools were present and revalidated:

- `list_local_sites`
- `start_local_site`
- `stop_local_site`
- `restart_local_site`
- `local_environment_check`
- `local_site_info`
- `local_logs`
- `local_doctor`
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

## `safe` Profile Validation

Validated successfully:

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
- `execute_wp_cli option get home`
- `execute_wp_cli search-replace ... --dry-run`
- `mysql_query`
- `mysql_schema`
- `db_export`
- `backup_site` with `scope=database`
- `backup_site` with `scope=full`
- resource listing and reads
- prompt listing and retrieval

Blocked correctly in `safe`:

- `mysql_execute`
- `db_import`
- `restore_backup`
- `write_site_file`
- `delete_site_file`
- WP-CLI write action: `plugin activate`
- live `search-replace`
- `execute_wp_cli eval`

## `full-access` Profile Validation

Validated successfully:

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
- WP-CLI write flow by creating and deleting a temporary draft post
- `mysql_query`
- `mysql_schema`
- `mysql_execute`
- MySQL write flow by creating and dropping a temporary table
- `db_export`
- `db_import`
- `backup_site` with `scope=database`
- `backup_site` with `scope=full`
- `restore_backup` from a database backup
- `restore_backup` from a full backup
- `local_doctor` after restore
- resource reads
- prompt retrieval

## Artifact Validation

The following were verified on disk during the Windows runs:

- exported `.sql` files
- database backup directories
- full backup directories
- `manifest.json`
- copied `app`
- copied `conf`
- copied `logs`
- SQL dump inside full backup
- pre-import SQL backup path
- pre-restore backup directories for both database restore and full restore

Examples from the final reruns included:

- SQL export under `%TEMP%\localwp-mcp-rerun-safe\exports\...`
- SQL export under `%TEMP%\localwp-mcp-rerun-full\exports\...`
- full backup directories under `%TEMP%\localwp-mcp-rerun-safe\backups\...`
- full backup directories under `%TEMP%\localwp-mcp-rerun-full\backups\...`

## Resources And Prompts

Validated resources:

- `localwp://sites`
- `localwp://sites/{siteName}/summary`
- `localwp://sites/{siteName}/doctor`
- `localwp://sites/{siteName}/logs`

Validated prompts:

- `diagnose_local_site`
- `restore_local_site`

## Windows-Specific Notes

### Good Windows-specific findings

- Local metadata files were readable from `%APPDATA%\Local`
- Local app install under `%LOCALAPPDATA%\Programs\Local` was resolved correctly
- Local Lightning service packages in `%APPDATA%\Local\lightning-services` were resolved correctly after the fix
- Windows TCP MySQL connection mode worked correctly
- Windows file copy behavior during backup and full restore worked correctly
- Windows site file operations behaved correctly after path normalization

### Not-ideal but acceptable observations

- HTTP reachability probes returned `HTTP 404` while the site was healthy and running

This is not a blocker. It still proved:

- nginx was up
- the Local site was reachable
- lifecycle operations changed external reachability as expected

This machine also validated on:

- Node `v24.14.1`

The package declares:

- Node `>=20`

So Windows support is strongly validated here, but not yet specifically re-run on an actual Node `20.x` runtime in this report.

## Remaining Limitations

The Windows validation is strong, but a few release-hardening items are still outside the scope of this report:

- no packaged `npm pack` / tarball install validation in this run
- no clean second Windows machine validation in this report
- no multisite-specific Windows validation in this report
- no legacy `site-binaries-win32` live validation in this report
- no non-default Local site path validation outside `~\Local Sites`

These are not blockers for the current repo state, but they are still useful extra coverage for a public release.

## Final Assessment

`localwp-mcp` is in good shape on Windows after the fixes described above.

The important claim supported by this report is:

- this MCP now works end to end on a real Windows LocalWP setup
- the main Windows-specific breakages that appeared during live testing were fixed in code
- the fixes are now covered by tests where appropriate

No push or publish action was taken as part of this work.
