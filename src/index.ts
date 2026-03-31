#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer } from "./server.js";

async function run() {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("localwp-mcp server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error running localwp-mcp:", error);
  process.exit(1);
});
