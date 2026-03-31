import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { runEnvironmentCheck } from "./environment-check.js";
import { loadLocalSites, summarizeSite } from "./local-sites.js";
import { runLocalDoctor } from "./local-doctor.js";
import { collectLocalLogs } from "./logs.js";

const siteSummaryTemplate = new ResourceTemplate("localwp://sites/{siteName}/summary", {
  list: async () => {
    const sites = await loadLocalSites();

    return {
      resources: sites.map((site) => ({
        uri: `localwp://sites/${encodeURIComponent(site.name)}/summary`,
        name: `${site.name} summary`,
      })),
    };
  },
  complete: {
    siteName: completeSiteNames,
  },
});

const siteDoctorTemplate = new ResourceTemplate("localwp://sites/{siteName}/doctor", {
  list: async () => {
    const sites = await loadLocalSites();

    return {
      resources: sites.map((site) => ({
        uri: `localwp://sites/${encodeURIComponent(site.name)}/doctor`,
        name: `${site.name} doctor`,
      })),
    };
  },
  complete: {
    siteName: completeSiteNames,
  },
});

const siteLogsTemplate = new ResourceTemplate("localwp://sites/{siteName}/logs", {
  list: async () => {
    const sites = await loadLocalSites();

    return {
      resources: sites.map((site) => ({
        uri: `localwp://sites/${encodeURIComponent(site.name)}/logs`,
        name: `${site.name} logs`,
      })),
    };
  },
  complete: {
    siteName: completeSiteNames,
  },
});

export function registerResources(server: McpServer) {
  server.registerResource(
    "local-sites-catalog",
    "localwp://sites",
    {
      title: "Local Sites Catalog",
      description: "JSON catalog of LocalWP sites discovered on this machine.",
      mimeType: "application/json",
    },
    async (uri) => {
      const sites = await loadLocalSites();

      return createJsonResourceResult(
        uri.toString(),
        sites.map((site) => summarizeSite(site)),
      );
    },
  );

  server.registerResource(
    "local-site-summary",
    siteSummaryTemplate,
    {
      title: "Local Site Summary",
      description: "Machine-readable Local site summary and runtime resolution details.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const siteName = getTemplateVariable(variables.siteName);
      const payload = await runEnvironmentCheck(
        { siteName },
        { probeWpCli: false, probeMysql: false },
      );

      return createJsonResourceResult(uri.toString(), payload);
    },
  );

  server.registerResource(
    "local-site-doctor",
    siteDoctorTemplate,
    {
      title: "Local Site Doctor",
      description: "Health summary and next steps for one LocalWP site.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const siteName = getTemplateVariable(variables.siteName);
      const payload = await runLocalDoctor({ siteName });

      return createJsonResourceResult(uri.toString(), payload);
    },
  );

  server.registerResource(
    "local-site-logs",
    siteLogsTemplate,
    {
      title: "Local Site Logs",
      description: "Recent site and Local app logs for one LocalWP site.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const siteName = getTemplateVariable(variables.siteName);
      const payload = await collectLocalLogs(
        { siteName },
        { scope: "all", lines: 40 },
      );

      return createJsonResourceResult(uri.toString(), payload);
    },
  );
}

async function completeSiteNames(value: string) {
  const sites = await loadLocalSites();
  const query = value.trim().toLowerCase();

  return sites
    .map((site) => site.name)
    .filter((siteName) =>
      query ? siteName.toLowerCase().includes(query) : true,
    )
    .sort();
}

function createJsonResourceResult(uri: string, payload: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function getTemplateVariable(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return decodeURIComponent(value[0] || "");
  }

  return decodeURIComponent(value || "");
}
