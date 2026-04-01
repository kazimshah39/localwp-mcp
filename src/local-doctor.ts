import { config } from "./config.js";
import { runEnvironmentCheck } from "./environment-check.js";
import { summarizeLogAvailability } from "./logs.js";
import type { SiteSelection } from "./types.js";

type DoctorCheckStatus = "ok" | "warning" | "error";

interface DoctorCheck {
  id: string;
  status: DoctorCheckStatus;
  title: string;
  message: string;
}

export async function runLocalDoctor(selection: SiteSelection) {
  const diagnostics = await runEnvironmentCheck(selection, {
    probeWpCli: true,
    probeMysql: true,
  });
  const logAvailability = await summarizeLogAvailability(selection);
  const checks: DoctorCheck[] = [];
  const siteCatalogCount = Number(
    diagnostics.sites.ok && "count" in diagnostics.sites
      ? diagnostics.sites.count
      : 0,
  );
  const siteContext =
    diagnostics.siteContext.ok && "site" in diagnostics.siteContext
      ? diagnostics.siteContext
      : null;

  checks.push({
    id: "local_metadata",
    status:
      diagnostics.corePaths.localAppSupportDir.readable &&
      diagnostics.corePaths.localSitesJson.readable &&
      diagnostics.corePaths.localSiteStatusesJson.readable
        ? "ok"
        : "error",
    title: "Local metadata",
    message:
      diagnostics.corePaths.localAppSupportDir.readable &&
      diagnostics.corePaths.localSitesJson.readable &&
      diagnostics.corePaths.localSiteStatusesJson.readable
        ? "Local metadata files are readable."
        : "Local metadata files are missing or unreadable. Check LOCAL_APP_SUPPORT_DIR or open Local once on this machine.",
  });

  checks.push({
    id: "local_tooling",
    status: diagnostics.tooling.ok ? "ok" : "error",
    title: "Local tooling",
    message: diagnostics.tooling.ok
      ? "Local's WP-CLI and helper binaries were resolved."
      : "Local tooling could not be resolved. Check the Local install path or LOCAL_EXTRA_RESOURCES_DIRS.",
  });

  checks.push({
    id: "site_catalog",
    status: diagnostics.sites.ok && siteCatalogCount > 0 ? "ok" : "error",
    title: "Site catalog",
    message:
      diagnostics.sites.ok && siteCatalogCount > 0
        ? `Found ${siteCatalogCount} Local site(s).`
        : "No Local sites were found. Create, import, or start a Local site first.",
  });

  if (!siteContext) {
    checks.push({
      id: "site_resolution",
      status: "error",
      title: "Site resolution",
      message:
        "error" in diagnostics.siteContext
          ? diagnostics.siteContext.error
          : "The Local site could not be resolved.",
    });
  } else {
    const site = siteContext.site;

    checks.push({
      id: "site_status",
      status: site.status === "running" ? "ok" : "warning",
      title: "Site status",
      message:
        site.status === "running"
          ? `The selected site '${site.name}' is running.`
          : `The selected site '${site.name}' is '${site.status}'. Start it in Local before using WP-CLI, MySQL, or backup tools.`,
    });

    checks.push({
      id: "wp_root",
      status: siteContext.wpRoot.readable ? "ok" : "error",
      title: "WordPress root",
      message: siteContext.wpRoot.readable
        ? "The WordPress root is readable."
        : "The WordPress root is not readable.",
    });

    checks.push({
      id: "php_runtime",
      status:
        siteContext.phpBinary.readable &&
        siteContext.phpBinary.executable
          ? "ok"
          : "error",
      title: "PHP runtime",
      message:
        siteContext.phpBinary.readable &&
        siteContext.phpBinary.executable
          ? "The Local PHP runtime is available."
          : "The Local PHP runtime is missing or not executable.",
    });

    checks.push({
      id: "mysql_runtime",
      status:
        siteContext.mysqlBinary.readable &&
        siteContext.mysqlBinary.executable
          ? "ok"
          : "error",
      title: "MySQL runtime",
      message:
        siteContext.mysqlBinary.readable &&
        siteContext.mysqlBinary.executable
          ? "The Local MySQL runtime is available."
          : "The Local MySQL runtime is missing or not executable.",
    });

    const mysqlConnectionOk =
      siteContext.mysqlConnection.mode === "socket"
        ? Boolean(siteContext.mysqlConnection.socket?.readable)
        : Boolean(siteContext.mysqlConnection.port);

    checks.push({
      id: "mysql_connection",
      status: mysqlConnectionOk ? "ok" : "warning",
      title: "MySQL connection",
      message: mysqlConnectionOk
        ? "MySQL connection details were resolved."
        : "MySQL connection details are incomplete. Start the site in Local and check the runtime configuration.",
    });

    if (siteContext.wpCliProbe) {
      checks.push({
        id: "wp_cli_probe",
        status: siteContext.wpCliProbe.ok ? "ok" : "error",
        title: "WP-CLI probe",
        message: siteContext.wpCliProbe.ok
          ? "WP-CLI responded successfully."
          : `WP-CLI probe failed: ${siteContext.wpCliProbe.error}`,
      });
    }

    if (siteContext.mysqlProbe) {
      checks.push({
        id: "mysql_probe",
        status: siteContext.mysqlProbe.ok ? "ok" : "error",
        title: "MySQL probe",
        message: siteContext.mysqlProbe.ok
          ? "MySQL responded successfully."
          : `MySQL probe failed: ${siteContext.mysqlProbe.error}`,
      });
    }
  }

  const readableSiteLogs = logAvailability.siteLogs.filter((log) => log.readable);
  const readableGlobalLogs = logAvailability.globalLogs.filter((log) => log.readable);

  checks.push({
    id: "site_logs",
    status:
      logAvailability.site && readableSiteLogs.length > 0 ? "ok" : "warning",
    title: "Site logs",
    message:
      logAvailability.site && readableSiteLogs.length > 0
        ? `Found ${readableSiteLogs.length} readable site log file(s).`
        : "No readable site logs were found for the selected site yet.",
  });

  checks.push({
    id: "global_logs",
    status: readableGlobalLogs.length > 0 ? "ok" : "warning",
    title: "Local app logs",
    message:
      readableGlobalLogs.length > 0
        ? `Found ${readableGlobalLogs.length} readable Local app log file(s).`
        : "No readable Local app logs were found.",
  });

  const overallStatus = summarizeDoctorStatus(checks);

  return {
    overallStatus,
    summary: buildDoctorSummary(overallStatus),
    accessProfile: config.profile,
    requestedSiteId: selection.siteId || null,
    requestedSiteName: selection.siteName || null,
    site: siteContext ? siteContext.site : null,
    checks,
    nextSteps: buildNextSteps(checks),
    logSummary: {
      siteLogs: readableSiteLogs.map((log) => ({
        label: log.label,
        path: log.path,
      })),
      globalLogs: readableGlobalLogs.map((log) => ({
        label: log.label,
        path: log.path,
      })),
    },
  };
}

export function summarizeDoctorStatus(checks: DoctorCheck[]) {
  if (checks.some((check) => check.status === "error")) {
    return "error";
  }

  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }

  return "ok";
}

function buildDoctorSummary(status: DoctorCheckStatus) {
  if (status === "ok") {
    return "LocalWP MCP looks healthy for this machine and site.";
  }

  if (status === "warning") {
    return "LocalWP MCP is mostly working, but a few things need attention.";
  }

  return "LocalWP MCP found blocking problems that should be fixed before relying on the site tools.";
}

function buildNextSteps(checks: DoctorCheck[]) {
  const steps = new Set<string>();

  for (const check of checks) {
    if (check.status === "ok") {
      continue;
    }

    switch (check.id) {
      case "local_metadata":
        steps.add(
          "Open Local once and confirm the Local metadata directory is readable, or set LOCAL_APP_SUPPORT_DIR explicitly in the MCP config.",
        );
        break;
      case "local_tooling":
        steps.add(
          "Confirm Local is installed correctly and, if needed, set LOCAL_EXTRA_RESOURCES_DIRS or LOCAL_WP_CLI_PHAR in the MCP config.",
        );
        break;
      case "site_catalog":
      case "site_resolution":
        steps.add(
          "Pass siteName or siteId in the tool call, or set LOCAL_SITE_NAME / LOCAL_SITE_ID in the MCP config.",
        );
        break;
      case "site_status":
      case "mysql_connection":
      case "mysql_probe":
        steps.add(
          "Start the site in Local and rerun local_doctor or local_environment_check.",
        );
        break;
      case "wp_cli_probe":
        steps.add(
          "Run local_logs next and check the PHP, nginx, and Local app logs for startup or bootstrap errors.",
        );
        break;
      case "site_logs":
      case "global_logs":
        steps.add(
          "Use local_logs to inspect available logs and confirm Local has written fresh entries on this machine.",
        );
        break;
      default:
        break;
    }
  }

  return [...steps];
}
