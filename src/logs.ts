import { open, readdir, stat } from "fs/promises";
import path from "path";

import { config } from "./config.js";
import { buildSiteContext, summarizeSite } from "./local-sites.js";
import { isReadablePath } from "./process-utils.js";
import type { LogScope, SiteContext, SiteSelection } from "./types.js";

const MAX_TAIL_BYTES = 256 * 1024;
const globalLogPattern =
  /^local-(?:lightning(?:-verbose)?|by-flywheel)\d*\.log$/i;

interface LogCandidate {
  key: string;
  label: string;
  path: string;
  source: "site" | "global";
  format: "text" | "csv";
}

export function clampLogLines(lines: number | undefined) {
  if (!lines) {
    return config.defaultLogTailLines;
  }

  return Math.min(Math.max(lines, 1), config.maxLogTailLines);
}

export async function collectLocalLogs(
  selection: SiteSelection,
  options: {
    scope?: LogScope;
    lines?: number;
  } = {},
) {
  const scope = options.scope || "site";
  const lines = clampLogLines(options.lines);
  const includeSite = scope === "site" || scope === "all";
  const includeGlobal = scope === "global" || scope === "all";

  const context = includeSite ? await buildSiteContext(selection) : null;
  const siteLogs = context
    ? await describeLogFiles(buildSiteLogCandidates(context), lines, true)
    : [];
  const globalLogs = includeGlobal
    ? await describeLogFiles(await buildGlobalLogCandidates(), lines, true)
    : [];

  return {
    scope,
    requestedLines: lines,
    site: context ? summarizeSite(context.site) : null,
    siteLogs,
    globalLogs,
  };
}

export async function summarizeLogAvailability(selection: SiteSelection = {}) {
  let context: SiteContext | null = null;

  try {
    context = await buildSiteContext(selection);
  } catch {
    context = null;
  }

  const [siteLogs, globalLogs] = await Promise.all([
    context
      ? describeLogFiles(buildSiteLogCandidates(context), 0, false)
      : Promise.resolve([]),
    describeLogFiles(await buildGlobalLogCandidates(), 0, false),
  ]);

  return {
    site: context ? summarizeSite(context.site) : null,
    siteLogs,
    globalLogs,
  };
}

export async function readLastLines(filePath: string, lineCount: number) {
  const handle = await open(filePath, "r");

  try {
    const fileStats = await stat(filePath);
    const bytesToRead = Math.min(fileStats.size, MAX_TAIL_BYTES);
    const start = Math.max(0, fileStats.size - bytesToRead);
    const buffer = Buffer.alloc(bytesToRead);

    if (bytesToRead > 0) {
      await handle.read(buffer, 0, bytesToRead, start);
    }

    const raw = buffer.toString("utf8");
    const lines = raw.split(/\r?\n/);

    if (start > 0 && lines.length > 0) {
      lines.shift();
    }

    if (lines[lines.length - 1] === "") {
      lines.pop();
    }

    const excerptLines = lineCount > 0 ? lines.slice(-lineCount) : [];

    return {
      excerpt: excerptLines.join("\n"),
      excerptLineCount: excerptLines.length,
      truncated: fileStats.size > bytesToRead || lines.length > lineCount,
      sizeBytes: fileStats.size,
      modifiedAt: fileStats.mtime.toISOString(),
    };
  } finally {
    await handle.close();
  }
}

function buildSiteLogCandidates(context: SiteContext): LogCandidate[] {
  return [
    {
      key: "wp_debug_log",
      label: "WordPress Debug Log",
      path: path.join(context.wpRoot, "wp-content", "debug.log"),
      source: "site",
      format: "text",
    },
    {
      key: "php_error_log",
      label: "PHP Error Log",
      path: path.join(context.site.absolutePath, "logs", "php", "error.log"),
      source: "site",
      format: "text",
    },
    {
      key: "php_fpm_log",
      label: "PHP-FPM Log",
      path: path.join(context.site.absolutePath, "logs", "php", "php-fpm.log"),
      source: "site",
      format: "text",
    },
    {
      key: "nginx_error_log",
      label: "Site Nginx Error Log",
      path: path.join(context.site.absolutePath, "logs", "nginx", "error.log"),
      source: "site",
      format: "text",
    },
    {
      key: "runtime_nginx_error_log",
      label: "Runtime Nginx Error Log",
      path: path.join(context.runtimeDir, "nginx", "logs", "error.log"),
      source: "site",
      format: "text",
    },
    {
      key: "mysql_general_log",
      label: "MySQL General Log",
      path: path.join(
        context.runtimeDir,
        "mysql",
        "data",
        "mysql",
        "general_log.CSV",
      ),
      source: "site",
      format: "csv",
    },
    {
      key: "mysql_slow_log",
      label: "MySQL Slow Log",
      path: path.join(
        context.runtimeDir,
        "mysql",
        "data",
        "mysql",
        "slow_log.CSV",
      ),
      source: "site",
      format: "csv",
    },
  ];
}

async function buildGlobalLogCandidates(): Promise<LogCandidate[]> {
  const logDirectory = getGlobalLogDirectory();

  if (!(await isReadablePath(logDirectory))) {
    return [
      {
        key: "local_log_directory",
        label: "Local Global Log Directory",
        path: logDirectory,
        source: "global",
        format: "text",
      },
    ];
  }

  const entries = await readdir(logDirectory, { withFileTypes: true });
  const logFiles = entries
    .filter((entry) => entry.isFile() && globalLogPattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));

  return logFiles.map((fileName) => ({
    key: `global_${fileName.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
    label: `Local App Log: ${fileName}`,
    path: path.join(logDirectory, fileName),
    source: "global" as const,
    format: "text" as const,
  }));
}

async function describeLogFiles(
  candidates: LogCandidate[],
  lines: number,
  includeContent: boolean,
) {
  return Promise.all(
    candidates.map(async (candidate) => {
      const readable = await isReadablePath(candidate.path);

      if (!readable) {
        return {
          ...candidate,
          readable: false,
          excerpt: null,
          excerptLineCount: 0,
          truncatedExcerpt: false,
          sizeBytes: null,
          modifiedAt: null,
        };
      }

      const summary =
        includeContent && lines > 0
          ? await readLastLines(candidate.path, lines)
          : await describeFile(candidate.path);

      return {
        ...candidate,
        readable: true,
        excerpt: includeContent && lines > 0 ? summary.excerpt : null,
        excerptLineCount: summary.excerptLineCount,
        truncatedExcerpt: summary.truncated,
        sizeBytes: summary.sizeBytes,
        modifiedAt: summary.modifiedAt,
      };
    }),
  );
}

async function describeFile(filePath: string) {
  const fileStats = await stat(filePath);

  return {
    excerpt: "",
    excerptLineCount: 0,
    truncated: false,
    sizeBytes: fileStats.size,
    modifiedAt: fileStats.mtime.toISOString(),
  };
}

function getGlobalLogDirectory() {
  if (config.platform === "darwin") {
    return path.join(config.homeDir, "Library", "Logs");
  }

  return config.localAppSupportDir;
}
