import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools/index.js";
import { resolvePackageVersion } from "./version.js";

const SERVER_NAME = "localwp-mcp";

export function resolveServerVersion() {
  return resolvePackageVersion();
}

export function createServer() {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: resolveServerVersion(),
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
      },
    },
  );

  registerResources(server);
  registerPrompts(server);
  registerTools(server);

  return server;
}
