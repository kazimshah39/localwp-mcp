import { config } from "./config.js";
import { startLocalSite, stopLocalSite } from "./local-graphql.js";
import { readJsonFile, resolveSite, summarizeSite } from "./local-sites.js";
import type { LocalSiteStatus, SiteSelection } from "./types.js";

export type SiteLifecycleAction = "start" | "stop" | "restart";
export type SiteLifecycleStep = "start" | "stop";

interface SiteLifecyclePlan {
  noOp: boolean;
  performedActions: SiteLifecycleStep[];
}

export async function runSiteLifecycleAction(
  action: SiteLifecycleAction,
  selection: SiteSelection,
) {
  const site = await resolveSite(selection);
  const plan = planSiteLifecycleAction(action, site.status);
  let reportedStatus = site.status;
  let metadataStatus = site.status;

  for (const step of plan.performedActions) {
    const result =
      step === "start" ? await startLocalSite(site.id) : await stopLocalSite(site.id);
    reportedStatus = result.status;
    metadataStatus = await waitForSiteStatus(site.id, result.status);
  }

  return {
    action,
    performedActions: plan.performedActions,
    noOp: plan.noOp,
    previousStatus: site.status,
    reportedStatus,
    metadataStatus,
    statusSettled: metadataStatus === reportedStatus,
    site: {
      ...summarizeSite(site),
      status: reportedStatus,
    },
    selectionMethod: site.selectionMethod,
    accessProfile: config.profile,
  };
}

export function planSiteLifecycleAction(
  action: SiteLifecycleAction,
  currentStatus: LocalSiteStatus,
): SiteLifecyclePlan {
  const normalizedStatus = currentStatus.toLowerCase();

  if (action === "start") {
    return normalizedStatus === "running"
      ? { noOp: true, performedActions: [] }
      : { noOp: false, performedActions: ["start"] };
  }

  if (action === "stop") {
    return normalizedStatus === "halted"
      ? { noOp: true, performedActions: [] }
      : { noOp: false, performedActions: ["stop"] };
  }

  if (normalizedStatus === "running") {
    return { noOp: false, performedActions: ["stop", "start"] };
  }

  return { noOp: false, performedActions: ["start"] };
}

async function waitForSiteStatus(siteId: string, expectedStatus: LocalSiteStatus) {
  const timeoutMs = Math.min(config.defaultTimeoutMs, 30_000);
  const startedAt = Date.now();
  let lastStatus = expectedStatus;

  while (Date.now() - startedAt < timeoutMs) {
    const statuses = await readJsonFile<Record<string, string>>(
      config.localSiteStatusesJson,
      {},
    );
    lastStatus = statuses[siteId] || "unknown";

    if (lastStatus === expectedStatus) {
      return lastStatus;
    }

    await delay(500);
  }

  return lastStatus;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
