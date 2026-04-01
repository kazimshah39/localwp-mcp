# Claude Code Setup

Use this guide when you want to add `localwp-mcp` to Claude Code.

## Transport

Use:

- `STDIO`

`localwp-mcp` does not currently provide a remote HTTP MCP endpoint.

## Recommended Command

The simplest setup is to add the MCP through the Claude Code CLI.

### macOS and Linux

```bash
claude mcp add localwp -- npx -y localwp-mcp
```

### Windows

On Windows, use `cmd /c` so Claude Code launches `npx` correctly:

```powershell
claude mcp add localwp -- cmd /c npx -y localwp-mcp
```

## Environment Variables

After adding the server, configure these as needed in your Claude Code MCP setup:

- `LOCALWP_MCP_PROFILE=safe`
- optional: `LOCAL_SITE_NAME=your-site-name`

If your Claude Code workflow uses project-specific MCP config, use the same command and environment values there.

## Recommended Starting Setup

Start with:

- `LOCALWP_MCP_PROFILE` = `safe`

Switch to:

- `LOCALWP_MCP_PROFILE` = `full-access`

only when you want the agent to make local writes, imports, restores, or other destructive changes.

## First Commands To Try

After Claude Code connects to the MCP, start with:

- `local_environment_check`
- `local_doctor`
- `list_local_sites`

## Troubleshooting

If Claude Code cannot launch the MCP:

- make sure Node.js and npm are installed
- make sure `npx -y localwp-mcp` works in your terminal
- on Windows, prefer the `cmd /c npx -y localwp-mcp` form

If the MCP launches but LocalWP is not detected:

1. start the site in LocalWP
2. run `local_environment_check`
3. run `local_doctor`
4. run `local_logs`
