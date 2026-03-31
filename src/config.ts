import os from "os";
import path from "path";

import {
  getDefaultLocalAppSupportDir,
  getDefaultLocalExtraResourcesDirs,
  getDefaultLocalLightningServiceDirs,
  getHelperBinDirCandidates,
  getWpCliConfigCandidates,
  getWpCliPharCandidates,
} from "./platform-paths.js";
import type { AccessProfile } from "./types.js";

const homeDir = os.homedir();
const platform = process.platform;
const arch = process.arch;
const defaultLocalAppSupportDir = getDefaultLocalAppSupportDir(
  platform,
  homeDir,
  process.env,
);
const defaultLocalExtraResourcesDirs = getDefaultLocalExtraResourcesDirs(
  platform,
  homeDir,
  process.env,
);
const localExtraResourcesDirs =
  process.env.LOCAL_EXTRA_RESOURCES_DIRS?.split(path.delimiter).filter(Boolean) ||
  defaultLocalExtraResourcesDirs;
const localLightningServicesDirs =
  process.env.LOCAL_LIGHTNING_SERVICES_DIRS
    ?.split(path.delimiter)
    .filter(Boolean) ||
  (process.env.LOCAL_LIGHTNING_SERVICES_DIR
    ? [process.env.LOCAL_LIGHTNING_SERVICES_DIR]
    : getDefaultLocalLightningServiceDirs(
        process.env.LOCAL_APP_SUPPORT_DIR || defaultLocalAppSupportDir,
        localExtraResourcesDirs,
      ));

export const config = {
  platform,
  arch,
  homeDir,
  localAppSupportDir:
    process.env.LOCAL_APP_SUPPORT_DIR || defaultLocalAppSupportDir,
  localExtraResourcesDirs,
  localRunDir:
    process.env.LOCAL_RUN_DIR ||
    path.join(
      process.env.LOCAL_APP_SUPPORT_DIR || defaultLocalAppSupportDir,
      "run",
    ),
  localLightningServicesDirs,
  localSitesJson:
    process.env.LOCAL_SITES_JSON ||
    path.join(
      process.env.LOCAL_APP_SUPPORT_DIR || defaultLocalAppSupportDir,
      "sites.json",
    ),
  localSiteStatusesJson:
    process.env.LOCAL_SITE_STATUSES_JSON ||
    path.join(
      process.env.LOCAL_APP_SUPPORT_DIR || defaultLocalAppSupportDir,
      "site-statuses.json",
    ),
  localGraphqlConnectionInfoJson:
    process.env.LOCAL_GRAPHQL_CONNECTION_INFO ||
    path.join(
      process.env.LOCAL_APP_SUPPORT_DIR || defaultLocalAppSupportDir,
      "graphql-connection-info.json",
    ),
  localWpCliPharCandidates: process.env.LOCAL_WP_CLI_PHAR
    ? [process.env.LOCAL_WP_CLI_PHAR]
    : getWpCliPharCandidates(platform, localExtraResourcesDirs),
  localWpCliConfigCandidates: process.env.LOCAL_WP_CLI_CONFIG
    ? [process.env.LOCAL_WP_CLI_CONFIG]
    : getWpCliConfigCandidates(localExtraResourcesDirs),
  localHelperBinDirCandidates: process.env.LOCAL_HELPER_BIN_DIRS
    ? process.env.LOCAL_HELPER_BIN_DIRS.split(path.delimiter).filter(Boolean)
    : getHelperBinDirCandidates(platform, localExtraResourcesDirs),
  defaultMysqlHost: process.env.LOCAL_MYSQL_HOST || "127.0.0.1",
  defaultTimeoutMs: 60_000,
  defaultMaxRows: 200,
  maxMaxRows: 1000,
  defaultLogTailLines: 120,
  maxLogTailLines: 500,
  backupsDirOverride: process.env.LOCALWP_MCP_BACKUPS_DIR || null,
  profile: normalizeAccessProfile(
    process.env.LOCALWP_MCP_PROFILE || "safe",
  ),
} as const;

export function normalizeAccessProfile(value: string): AccessProfile {
  const normalized = value.trim().toLowerCase();

  if (normalized === "safe") {
    return "safe";
  }

  if (["full-access", "full_access", "full"].includes(normalized)) {
    return "full-access";
  }

  throw new Error(
    "Invalid LOCALWP_MCP_PROFILE. Expected 'safe' or 'full-access'.",
  );
}
