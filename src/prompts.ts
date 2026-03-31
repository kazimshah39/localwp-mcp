import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    "diagnose_local_site",
    {
      title: "Diagnose Local Site",
      description:
        "Guides an AI agent through diagnosing a LocalWP site using the MCP's doctor, logs, and inspection tools.",
      argsSchema: {
        siteName: z
          .string()
          .optional()
          .describe("Optional Local site name, for example 'woo'."),
      },
    },
    async ({ siteName }) => {
      const target = siteName
        ? `the Local site '${siteName}'`
        : "the relevant Local site";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Diagnose ${target} using localwp-mcp.`,
                "Start with local_doctor and local_environment_check.",
                "Then inspect local_logs and, if needed, use execute_wp_cli, mysql_query, and mysql_schema to narrow down the issue.",
                "Summarize the root cause, supporting evidence, and the safest next actions.",
              ].join(" "),
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "restore_local_site",
    {
      title: "Restore Local Site",
      description:
        "Guides an AI agent through restoring a LocalWP site from a SQL dump or a backup_site directory.",
      argsSchema: {
        siteName: z
          .string()
          .describe("Local site name to restore, for example 'woo'."),
        sourcePath: z
          .string()
          .describe("Path to the .sql file or backup_site directory to restore."),
      },
    },
    async ({ siteName, sourcePath }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Restore the Local site '${siteName}' from '${sourcePath}'.`,
                "Use local_doctor first to confirm the site is healthy enough for restore work.",
                "Then use restore_backup with a pre-restore backup enabled.",
                "After the restore, verify the site with local_doctor, local_logs, execute_wp_cli, and a simple mysql_query.",
                "Report exactly what was restored, whether a restart is recommended, and any follow-up checks.",
              ].join(" "),
            },
          },
        ],
      };
    },
  );
}
