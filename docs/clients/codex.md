# Codex Desktop Setup

Use this guide when you want to add `localwp-mcp` to Codex Desktop as a custom MCP server.

## Transport

Choose:

- `STDIO`

Do not choose:

- `Streamable HTTP`

`localwp-mcp` is a local stdio MCP server today. It does not expose an HTTP endpoint or bearer-token flow.

## Values To Enter

In Codex Desktop, open:

1. Settings
2. MCP servers
3. Add custom MCP

Then enter:

- Name: `localwp`
- Transport: `STDIO`
- Command to launch: `npx`

Arguments:

1. `-y`
2. `localwp-mcp`

Environment variables:

- `LOCALWP_MCP_PROFILE` = `safe`

Optional environment variables:

- `LOCAL_SITE_NAME` = `your-site-name`
- `LOCAL_SITE_ID` = `your-site-id`
- `LOCALWP_MCP_BACKUPS_DIR` = custom backup directory if you do not want to use the default site backup folder

## Recommended Starting Setup

If you are not sure what to use, start with:

- `LOCALWP_MCP_PROFILE` = `safe`

Then add `LOCAL_SITE_NAME` if you want the MCP to focus on one Local site by default.

## Example

- Name: `localwp`
- Command to launch: `npx`
- Arguments:
  - `-y`
  - `localwp-mcp`
- Environment variables:
  - `LOCALWP_MCP_PROFILE` = `safe`
  - optional: `LOCAL_SITE_NAME` = `example-site`

## First Commands To Try

After saving the MCP, start with:

- `local_environment_check`
- `local_doctor`
- `list_local_sites`

These will quickly tell you whether:

- LocalWP metadata was found
- the target site is running
- WP-CLI is available
- MySQL is available

## Troubleshooting

If Codex cannot start the MCP:

- make sure Node.js and npm are installed
- make sure `npx` works in your terminal
- restart Codex after installing Node if needed

If Codex starts the MCP but it cannot find your Local site:

1. start the site in LocalWP
2. run `local_environment_check`
3. run `local_doctor`
4. run `local_logs`

If your Codex app only allows `Streamable HTTP` for the setup you are trying, `localwp-mcp` is not the right transport yet. Use the `STDIO` tab instead.
