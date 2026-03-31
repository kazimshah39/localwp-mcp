# Release Checklist

Use this checklist when preparing a public release of `localwp-mcp`.

Supporting docs:

- `docs/FIRST_RELEASE.md`
- `docs/releases/v0.1.0-beta.1.md`

## Before Tagging

- confirm the working tree is clean
- run `pnpm install`
- run `pnpm check`
- run `pnpm test`
- run `pnpm build`
- verify the README still matches the current tool and profile behavior
- verify `package.json` version and package name are correct
- verify `LICENSE`, `CONTRIBUTING.md`, and `SECURITY.md` are present

## Platform Confidence

Minimum release expectation:

- macOS live-tested
- Windows and Linux covered by tests and CI

Preferred release expectation:

- macOS live-tested
- Windows live-tested
- Linux covered by tests and CI

If Windows has not been live-tested yet, say that clearly in the release notes.

## npm Publish

Current package name:

- `localwp-mcp`

Suggested publish flow:

```bash
npm whoami
pnpm prepublishOnly
npm publish
```

Notes:

- unscoped npm packages are public
- npm currently requires either 2FA or a granular access token with bypass 2FA for publishing
- if you later automate publishing from GitHub Actions, trusted publishing is the safer long-term option

## GitHub Release

Recommended first public versions:

- `v0.1.0-beta.1`
- or `v0.1.0`

Suggested release notes sections:

- What it does
- Supported platforms
- Profiles: `safe` and `full-access`
- Major tools
- Known limitations
- Validation status

## After Publishing

- confirm the npm package page is live
- install the published package in a fresh directory
- verify the CLI starts
- update the README install section if needed
- create a GitHub release entry that matches the published version
- announce the project only after the package install path is confirmed
