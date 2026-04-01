# Cursor Setup

Use this guide when you want to add `localwp-mcp` to Cursor as a custom MCP server.

## Transport

Use:

- `STDIO`

Do not use:

- `Streamable HTTP`

`localwp-mcp` is a local stdio MCP server. It does not expose an HTTP MCP endpoint today.

## Configuration File

Cursor supports MCP configuration in JSON. A common project-local location is:

- `.cursor/mcp.json`

You can also keep the MCP configuration in your broader Cursor setup if that fits your workflow better.

## Example Configuration

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

## Recommended Starting Setup

Start with:

- `LOCALWP_MCP_PROFILE` = `safe`

Then add:

- `LOCAL_SITE_NAME` = `your-site-name`

if you want the MCP to target one Local site by default.

## First Commands To Try

After Cursor loads the MCP, start with:

- `local_environment_check`
- `local_doctor`
- `list_local_sites`

## Troubleshooting

If Cursor cannot start the MCP:

- make sure Node.js and npm are installed
- make sure `npx` works in your terminal
- restart Cursor after installing Node if needed

If the MCP starts but cannot find your LocalWP site:

1. start the site in LocalWP
2. run `local_environment_check`
3. run `local_doctor`
4. run `local_logs`
