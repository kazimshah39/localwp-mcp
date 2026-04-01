# OpenCode Setup

Use this guide when you want to add `localwp-mcp` to OpenCode.

## Transport

Use:

- local MCP server configuration

In OpenCode terms, `localwp-mcp` should be configured as:

- `"type": "local"`

Do not configure it as a remote MCP URL. `localwp-mcp` does not expose Streamable HTTP today.

## Configuration Shape

OpenCode supports MCP servers in its `mcp` config.

Example:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "localwp": {
      "type": "local",
      "command": ["npx", "-y", "localwp-mcp"],
      "enabled": true,
      "environment": {
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

## Recommended Starting Setup

Start with:

- `LOCALWP_MCP_PROFILE` = `safe`

Then add `LOCAL_SITE_NAME` if you want the MCP to default to one Local site.

## First Commands To Try

After OpenCode loads the MCP, start with:

- `local_environment_check`
- `local_doctor`
- `list_local_sites`

## Troubleshooting

If OpenCode cannot start the MCP:

- make sure Node.js and npm are installed
- make sure `npx -y localwp-mcp` works in your terminal
- confirm your OpenCode config uses `"type": "local"`

If OpenCode starts the MCP but your Local site is not available:

1. start the site in LocalWP
2. run `local_environment_check`
3. run `local_doctor`
4. run `local_logs`
