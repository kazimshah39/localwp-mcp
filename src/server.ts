import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools/index.js";

const SERVER_NAME = "localwp-mcp";
const SERVER_VERSION = process.env.npm_package_version || "0.1.0";

export function createServer() {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
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
