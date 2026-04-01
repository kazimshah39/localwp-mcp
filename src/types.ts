export type AccessProfile = "safe" | "full-access";
export type LogScope = "site" | "global" | "all";
export type BackupScope = "database" | "full";
export type BackupArtifactCategory =
  | "full_backup"
  | "database_backup"
  | "pre_restore_backup"
  | "database_export"
  | "pre_import_backup"
  | "sql_file";

export type LocalSiteStatus = "running" | "halted" | "unknown" | string;

export interface LocalSiteServices {
  nginx?: {
    ports?: {
      HTTP?: number[];
    };
  };
  mysql?: {
    version?: string;
    ports?: {
      MYSQL?: number[];
    };
  };
  php?: {
    version?: string;
  };
}

export interface LocalSiteRecord {
  id: string;
  name: string;
  path: string;
  domain?: string;
  localVersion?: string;
  mysql?: {
    database?: string;
    user?: string;
    password?: string;
  };
  services?: LocalSiteServices;
}

export interface LocalSite extends LocalSiteRecord {
  absolutePath: string;
  wpRoot: string;
  runtimeDir: string;
  status: LocalSiteStatus;
  selectionMethod?: string;
}

export interface SiteSelection {
  siteId?: string;
  siteName?: string;
}

export interface ServiceBinary {
  packageDir: string;
  platformDirName: string | null;
  binaryPath: string;
  layout: "lightning-services" | "site-binaries";
}

export interface SiteContext {
  site: LocalSite;
  selectionMethod?: string;
  runtimeDir: string;
  wpRoot: string;
  database: string;
  phpConfigDir: string;
  mysqlDefaultsFile: string;
  mysqlSocket: string | null;
  mysqlPort: number | null;
  mysqlHost: string | null;
  php: ServiceBinary;
  mysql: ServiceBinary;
  magickCoderModulePath: string;
}

export interface ResolvedLocalTooling {
  wpCliPhar: string;
  wpCliConfig: string | null;
  helperBinDirs: string[];
}

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export interface LocalGraphqlConnectionInfo {
  port: number;
  authToken: string;
  url: string;
  subscriptionUrl?: string;
}

export interface LocalSiteLifecycleMutationResult {
  id: string;
  name: string;
  status: LocalSiteStatus;
}

export interface MysqlQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  returnedRows: number;
  truncated: boolean;
  stderr: string | null;
}
