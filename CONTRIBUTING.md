# Contributing to localwp-mcp

Thanks for contributing to `localwp-mcp`.

This project is a LocalWP-aware MCP server for WordPress development. The goal is to keep it practical, cross-platform, and easy to use for real developer workflows.

## What We Optimize For

- clear developer UX
- reliable LocalWP detection
- safe defaults with explicit full-access opt-in
- good behavior on macOS, Windows, and Linux
- simple setup and low maintenance overhead

## Development Setup

Requirements:

- Node `20+`
- `pnpm`
- LocalWP installed if you want to run real integration tests

Install dependencies:

```bash
pnpm install
```

Useful commands:

```bash
pnpm check
pnpm test
pnpm build
node dist/index.js
```

## Project Structure

- `src/`
  TypeScript source
- `src/tools/`
  MCP tool registrations
- `tests/`
  unit tests
- `docs/maintainers/`
  release, validation, and maintainer docs
- `.github/`
  CI and GitHub community files

## Changes We Welcome

- LocalWP compatibility fixes
- cross-platform path and binary resolution improvements
- MCP usability improvements
- better diagnostics and logs
- backup and restore reliability improvements
- clearer docs and examples

## Before Opening a PR

Please try to keep changes focused.

If you change runtime behavior, run:

```bash
pnpm check
pnpm test
pnpm build
```

If your change affects Local integration, also run a real smoke test with a LocalWP site when possible.

Good examples:

- verify `local_environment_check`
- verify `local_doctor`
- verify the tool you changed through the real stdio server

## Cross-Platform Expectations

Please avoid changes that assume only one platform layout.

Be especially careful around:

- Local metadata paths
- `lightning-services` vs `site-binaries`
- MySQL socket vs TCP behavior
- path separators
- file copy and restore behavior

If you touch platform resolution logic, add or update tests in `tests/`.

## Pull Request Guidelines

- explain the user-facing problem
- explain the approach briefly
- mention any platform assumptions
- include validation steps
- keep the README in sync if behavior changed

If a change is risky, call that out clearly in the PR description.

## Security Notes

Please do not open public issues for security-sensitive bugs.

Use the process in [SECURITY.md](./SECURITY.md) instead.

## Release Notes

If your change affects installation, configuration, profiles, tools, or platform behavior, please update the relevant docs:

- [README.md](./README.md)
- [docs/maintainers/release-checklist.md](./docs/maintainers/release-checklist.md)
- [docs/maintainers/windows-validation-handoff.md](./docs/maintainers/windows-validation-handoff.md) when Windows validation steps change
