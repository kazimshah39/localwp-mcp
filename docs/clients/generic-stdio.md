# Generic STDIO MCP Client Setup

Use this guide for MCP clients that support launching a local server over `STDIO`.

## Supported Transport

`localwp-mcp` currently supports:

- `STDIO`

`localwp-mcp` does not currently support:

- `Streamable HTTP`

If your client only accepts an MCP URL and cannot launch a local command, it cannot use `localwp-mcp` yet.

## Recommended Launch Command

Use:

- command: `npx`
- arguments:
  - `-y`
  - `localwp-mcp`

Why `-y`:

- it avoids interactive install prompts in GUI clients
- it makes first-run setup more reliable

## Example Configuration Shape

Many MCP clients want a command, arguments, and environment variables.

Example:

```json
{
  "mcpServers": {
    "localwp": {
      "command": "npx",
      "args": ["-y", "localwp-mcp"],
      "env": {
        "LOCALWP_MCP_PROFILE": "safe"
      }
    }
  }
}
```

Optional environment variables:

- `LOCAL_SITE_NAME`
- `LOCAL_SITE_ID`
- `LOCALWP_MCP_BACKUPS_DIR`

## Recommended Starting Profile

Start with:

- `LOCALWP_MCP_PROFILE` = `safe`

Switch to:

- `LOCALWP_MCP_PROFILE` = `full-access`

only when you want the agent to perform writes, imports, restore operations, or destructive local changes.

## First Commands To Try

After the client connects, run:

- `local_environment_check`
- `local_doctor`
- `list_local_sites`

## Common Problems

### `npx` is not found

This usually means the app cannot see your Node/npm installation.

Check:

- Node is installed
- `npx` works in your terminal
- the client app was restarted after Node installation

### The MCP starts, but the site is missing

Check:

1. LocalWP is installed
2. the site exists in LocalWP
3. the site is started in LocalWP
4. `local_environment_check` can see Local metadata

### The client only offers Streamable HTTP

That client or setup mode is not compatible with `localwp-mcp` yet. This package needs a client that can launch a local `STDIO` server.
