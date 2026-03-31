import { config } from "./config.js";
import { assertReadable, spawnCommand } from "./process-utils.js";
import type { MysqlQueryResult, SiteContext } from "./types.js";

const mysqlReadOnlyVerbs = new Set([
  "SELECT",
  "SHOW",
  "DESCRIBE",
  "DESC",
  "EXPLAIN",
]);

export async function ensureMysqlReady(context: SiteContext) {
  if (context.site.status !== "running") {
    throw new Error(
      `The Local site '${context.site.name}' is not running. Start it in Local before using MySQL tools.`,
    );
  }

  if (context.mysqlSocket) {
    await assertReadable(
      context.mysqlSocket,
      `MySQL socket is not available for site '${context.site.name}'`,
    );
  } else if (!context.mysqlPort) {
    throw new Error(
      `No MySQL socket or TCP port is available for site '${context.site.name}'.`,
    );
  }
}

export async function executeMysqlStatement(
  context: SiteContext,
  sql: string,
  maxRows: number,
) {
  const args = [
    `--defaults-file=${context.mysqlDefaultsFile}`,
    "--batch",
    "--default-character-set=utf8mb4",
    `--execute=${sql}`,
  ];

  if (context.mysqlSocket) {
    args.push("--protocol=SOCKET", `--socket=${context.mysqlSocket}`);
  } else {
    args.push("--protocol=TCP", `--host=${context.mysqlHost || config.defaultMysqlHost}`);

    if (context.mysqlPort) {
      args.push(`--port=${context.mysqlPort}`);
    }
  }

  args.push(context.database);

  const result = await spawnCommand(context.mysql.binaryPath, args, {
    cwd: context.wpRoot,
    env: process.env,
  });

  if (result.timedOut) {
    throw new Error(
      `MySQL query timed out after ${config.defaultTimeoutMs / 1000}s for site '${context.site.name}'.`,
    );
  }

  if (result.exitCode !== 0) {
    throw new Error(
      [
        `MySQL exited with code ${result.exitCode} for site '${context.site.name}'.`,
        result.stderr,
        result.stdout,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }

  const parsed = parseMysqlBatchOutput(result.stdout, maxRows);

  return {
    columns: parsed.columns,
    rows: parsed.rows,
    totalRows: parsed.totalRows,
    returnedRows: parsed.rows.length,
    truncated: parsed.truncated,
    stderr: result.stderr || null,
  } satisfies MysqlQueryResult;
}

export function validateSafeSqlQuery(sql: string) {
  const normalizedSql = normalizeSqlStatement(sql);

  const verb = getSqlVerb(normalizedSql);
  if (!mysqlReadOnlyVerbs.has(verb)) {
    throw new Error(
      "The 'safe' profile only allows SELECT, SHOW, DESCRIBE, DESC, and EXPLAIN.",
    );
  }

  return normalizedSql;
}

export function validateFullAccessSql(sql: string) {
  return normalizeSqlStatement(sql);
}

export function normalizeSqlStatement(sql: string) {
  const normalizedSql = stripLeadingSqlComments(sql)
    .replace(/;+\s*$/, "")
    .trim();

  if (!normalizedSql) {
    throw new Error("SQL statement cannot be empty.");
  }

  if (normalizedSql.includes(";")) {
    throw new Error("Only a single SQL statement is allowed.");
  }

  if (
    /\bINTO\s+OUTFILE\b/i.test(normalizedSql) ||
    /\bINTO\s+DUMPFILE\b/i.test(normalizedSql) ||
    /\bLOAD_FILE\s*\(/i.test(normalizedSql) ||
    /\bLOAD\s+DATA\b/i.test(normalizedSql)
  ) {
    throw new Error("File read/write SQL features are blocked.");
  }

  return normalizedSql;
}

export function getSqlVerb(sql: string) {
  const firstToken = sql.match(/^[A-Za-z]+/);

  if (!firstToken) {
    throw new Error("The SQL statement must start with a SQL verb.");
  }

  return firstToken[0].toUpperCase();
}

export function buildListTablesSql(databaseName: string) {
  return [
    "SELECT",
    "  TABLE_NAME,",
    "  TABLE_TYPE,",
    "  ENGINE,",
    "  TABLE_ROWS,",
    "  CREATE_TIME,",
    "  UPDATE_TIME",
    "FROM INFORMATION_SCHEMA.TABLES",
    `WHERE TABLE_SCHEMA = '${escapeSqlLiteral(databaseName)}'`,
    "ORDER BY TABLE_NAME",
  ].join(" ");
}

export function buildDescribeTableSql(databaseName: string, tableName: string) {
  return [
    "SELECT",
    "  COLUMN_NAME,",
    "  COLUMN_TYPE,",
    "  IS_NULLABLE,",
    "  COLUMN_DEFAULT,",
    "  COLUMN_KEY,",
    "  EXTRA",
    "FROM INFORMATION_SCHEMA.COLUMNS",
    `WHERE TABLE_SCHEMA = '${escapeSqlLiteral(databaseName)}'`,
    `  AND TABLE_NAME = '${escapeSqlLiteral(tableName)}'`,
    "ORDER BY ORDINAL_POSITION",
  ].join(" ");
}

export function clampMaxRows(maxRows: number | undefined) {
  if (!maxRows) {
    return config.defaultMaxRows;
  }

  return Math.min(Math.max(maxRows, 1), config.maxMaxRows);
}

function parseMysqlBatchOutput(output: string, maxRows: number) {
  const trimmed = output.trim();

  if (!trimmed) {
    return {
      columns: [],
      rows: [],
      totalRows: 0,
      truncated: false,
    };
  }

  const lines = trimmed.split(/\r?\n/);
  const header = lines.shift();

  if (!header) {
    return {
      columns: [],
      rows: [],
      totalRows: 0,
      truncated: false,
    };
  }

  const columns = header.split("\t").map((value) => decodeMysqlHeader(value));
  const rawRows = lines
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t").map(decodeMysqlValue));
  const truncated = rawRows.length > maxRows;
  const limitedRows = rawRows.slice(0, maxRows);
  const rows = limitedRows.map((values) => {
    const row: Record<string, unknown> = {};

    columns.forEach((column, index) => {
      row[column] = values[index] ?? null;
    });

    return row;
  });

  return {
    columns,
    rows,
    totalRows: rawRows.length,
    truncated,
  };
}

function decodeMysqlValue(value: string) {
  if (value === "NULL") {
    return null;
  }

  return value.replace(/\\([0btnrZ\\])/g, (_, token: string) => {
    switch (token) {
      case "0":
        return "\0";
      case "b":
        return "\b";
      case "t":
        return "\t";
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "Z":
        return "\x1a";
      case "\\":
        return "\\";
      default:
        return token;
    }
  });
}

function decodeMysqlHeader(value: string) {
  return decodeMysqlValue(value) ?? "";
}

function stripLeadingSqlComments(sql: string) {
  let result = sql.trimStart();

  while (result) {
    if (result.startsWith("/*")) {
      const endIndex = result.indexOf("*/");

      if (endIndex === -1) {
        throw new Error("SQL contains an unterminated block comment.");
      }

      result = result.slice(endIndex + 2).trimStart();
      continue;
    }

    if (result.startsWith("--") || result.startsWith("#")) {
      const newlineIndex = result.indexOf("\n");
      result =
        newlineIndex === -1
          ? ""
          : result.slice(newlineIndex + 1).trimStart();
      continue;
    }

    break;
  }

  return result;
}

function escapeSqlLiteral(value: string) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
