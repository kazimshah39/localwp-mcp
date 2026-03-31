# First Release Guide

This guide is the shortest path to the first public release of `localwp-mcp`.

## Recommended First Version

Recommended:

- `0.1.0-beta.1`

Why:

- the project is already strong enough to publish
- macOS has been live-tested
- Windows live validation is still pending
- a beta label gives you room to tighten platform confidence without overselling

If you want to skip beta, publish `0.1.0` instead.

## Option A: Publish `0.1.0-beta.1`

Run these commands from the repo root:

```bash
git pull --ff-only
pnpm install
pnpm check
pnpm test
pnpm build
npm whoami
npm version 0.1.0-beta.1
npm publish --access public
git push origin HEAD --follow-tags
```

Then create a GitHub release for:

- `v0.1.0-beta.1`

Use the release notes draft in:

- `docs/maintainers/releases/v0.1.0-beta.1.md`

## Option B: Publish `0.1.0`

If you decide to go stable right away and the version is already `0.1.0`, run:

```bash
git pull --ff-only
pnpm install
pnpm check
pnpm test
pnpm build
npm whoami
npm publish --access public
git push origin HEAD
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

If you change the package version before that, update `package.json` first and then publish.

## After npm Publish

Verify the package is live:

```bash
npm view localwp-mcp version
```

Smoke-test the published package in a fresh directory:

```bash
mkdir -p /tmp/localwp-mcp-smoke
cd /tmp/localwp-mcp-smoke
npm init -y
npm install localwp-mcp
npx localwp-mcp
```

The CLI should start on stdio and print:

```text
localwp-mcp server running on stdio
```

## After GitHub Release

Update the README install section if needed so it includes the final npm install path.

Suggested install examples after publish:

```bash
npm install -g localwp-mcp
```

or MCP client config using the package entrypoint:

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

## Suggested Public Positioning

Use wording like:

- Supports macOS, Windows, and Linux
- Live-tested on macOS
- Windows and Linux support is implemented with platform-aware code and tests

Avoid claiming full live verification on every platform until the Windows validation run is complete.
