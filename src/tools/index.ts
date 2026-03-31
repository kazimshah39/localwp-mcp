import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerBackupSiteTool } from "./backup-site.js";
import { registerDbExportTool } from "./db-export.js";
import { registerDbImportTool } from "./db-import.js";
import { registerExecuteWpCliTool } from "./execute-wp-cli.js";
import { registerLocalDoctorTool } from "./local-doctor.js";
import { registerLocalEnvironmentCheckTool } from "./local-environment-check.js";
import { registerLocalLogsTool } from "./local-logs.js";
import { registerListLocalSitesTool } from "./list-local-sites.js";
import { registerLocalSiteInfoTool } from "./local-site-info.js";
import { registerMysqlExecuteTool } from "./mysql-execute.js";
import { registerMysqlQueryTool } from "./mysql-query.js";
import { registerMysqlSchemaTool } from "./mysql-schema.js";
import { registerRestoreBackupTool } from "./restore-backup.js";

export function registerTools(server: McpServer) {
  registerListLocalSitesTool(server);
  registerLocalEnvironmentCheckTool(server);
  registerLocalDoctorTool(server);
  registerLocalLogsTool(server);
  registerLocalSiteInfoTool(server);
  registerBackupSiteTool(server);
  registerDbExportTool(server);
  registerDbImportTool(server);
  registerRestoreBackupTool(server);
  registerMysqlQueryTool(server);
  registerMysqlExecuteTool(server);
  registerMysqlSchemaTool(server);
  registerExecuteWpCliTool(server);
}
