import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { runLocalDoctor } from "../local-doctor.js";
import { createErrorToolResult, createJsonToolResult } from "../results.js";
import { siteSelectorSchema } from "../tool-schemas.js";

export function registerLocalDoctorTool(server: McpServer) {
  server.registerTool(
    "local_doctor",
    {
      description:
        "Runs a practical LocalWP health check for the selected site, including site resolution, Local tooling, probes, and log availability.",
      inputSchema: {
        ...siteSelectorSchema,
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ siteId, siteName }) => {
      try {
        const result = await runLocalDoctor({ siteId, siteName });
        return createJsonToolResult(result);
      } catch (error) {
        return createErrorToolResult(error);
      }
    },
  );
}
