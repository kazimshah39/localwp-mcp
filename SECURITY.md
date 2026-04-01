# Security Policy

## Supported Versions

This project is still early-stage.

Security fixes are expected to land in:

- the latest release on the default branch
- the current `0.x` release line

Older releases may not receive security updates.

## Reporting a Vulnerability

Please do not open a public GitHub issue for security vulnerabilities.

Preferred process:

1. Use GitHub private vulnerability reporting or a repository security advisory if it is enabled.
2. Share enough detail to reproduce the issue safely.
3. Include affected platform details if relevant:
   - macOS
   - Windows
   - Linux
4. Include whether the issue affects:
   - `safe`
   - `full-access`
   - both

Good reports include:

- affected version
- impact
- reproduction steps
- proof-of-concept input when safe to share
- whether sensitive files, database contents, or shell execution are involved

## What Counts As Security-Relevant Here

Examples include:

- command injection
- path traversal
- unintended arbitrary file access
- unintended arbitrary SQL execution outside the selected access profile
- privilege bypass between `safe` and `full-access`
- unexpected secret exposure from LocalWP configuration or WordPress installs

## Response Expectations

Best effort targets:

- initial acknowledgement within 5 business days
- mitigation or next-step guidance after triage
- public disclosure only after a fix or mitigation is available

If private vulnerability reporting is not enabled yet, open a minimal public issue asking for a secure contact method without including exploit details.
