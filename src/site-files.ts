import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "fs/promises";
import path from "path";

import { config } from "./config.js";
import { resolveSite, summarizeSite } from "./local-sites.js";
import { isReadablePath } from "./process-utils.js";
import type { SiteSelection } from "./types.js";

const DEFAULT_READ_BYTES = 256 * 1024;
const MAX_READ_BYTES = 1024 * 1024;
const DEFAULT_LIST_ENTRIES = 200;
const MAX_LIST_ENTRIES = 1000;
const DEFAULT_SEARCH_MATCHES = 100;
const MAX_SEARCH_MATCHES = 500;
const SEARCH_FILE_SIZE_LIMIT = 512 * 1024;

interface ResolvedSiteFileTarget {
  siteRoot: string;
  siteRootReal: string;
  absolutePath: string;
  relativePath: string;
  exists: boolean;
}

interface SiteFileListEntry {
  path: string;
  absolutePath: string;
  kind: "file" | "directory" | "symlink" | "other";
  sizeBytes: number;
  modifiedAt: string;
}

function normalizeSiteRelativePath(relativePath: string) {
  if (relativePath === "" || relativePath === ".") {
    return ".";
  }

  return relativePath.split(path.sep).join("/");
}

export function clampSiteFileReadBytes(value: number | undefined) {
  if (!value) {
    return DEFAULT_READ_BYTES;
  }

  return Math.min(Math.max(value, 1), MAX_READ_BYTES);
}

export function clampSiteFileListEntries(value: number | undefined) {
  if (!value) {
    return DEFAULT_LIST_ENTRIES;
  }

  return Math.min(Math.max(value, 1), MAX_LIST_ENTRIES);
}

export function clampSiteFileSearchMatches(value: number | undefined) {
  if (!value) {
    return DEFAULT_SEARCH_MATCHES;
  }

  return Math.min(Math.max(value, 1), MAX_SEARCH_MATCHES);
}

export async function listSiteFiles(
  selection: SiteSelection,
  options: {
    directoryPath?: string;
    recursive?: boolean;
    maxDepth?: number;
    maxEntries?: number;
    includeHidden?: boolean;
  } = {},
) {
  const site = await resolveSite(selection);
  const target = await resolveSiteScopedPath(
    site.absolutePath,
    options.directoryPath || ".",
    {
      allowSiteRoot: true,
    },
  );
  const targetStats = await lstat(target.absolutePath);

  if (!targetStats.isDirectory()) {
    throw new Error(
      `The path '${target.relativePath}' is not a directory inside the selected Local site.`,
    );
  }

  const recursive = options.recursive ?? false;
  const maxDepth = recursive ? Math.max(options.maxDepth ?? 10, 0) : 0;
  const maxEntries = clampSiteFileListEntries(options.maxEntries);
  const includeHidden = options.includeHidden ?? false;
  const entries: SiteFileListEntry[] = [];
  const visitedDirectories = new Set<string>();
  let truncated = false;

  await walkDirectory(target.absolutePath, 0);

  return {
    site: summarizeSite(site),
    selectionMethod: site.selectionMethod,
    directoryPath: target.relativePath,
    absoluteDirectoryPath: target.absolutePath,
    recursive,
    maxDepth,
    maxEntries,
    includeHidden,
    truncated,
    entries,
  };

  async function walkDirectory(directoryPath: string, depth: number) {
    if (entries.length >= maxEntries || depth > maxDepth) {
      if (entries.length >= maxEntries) {
        truncated = true;
      }
      return;
    }

    const directoryRealPath = await realpath(directoryPath);

    if (visitedDirectories.has(directoryRealPath)) {
      return;
    }

    visitedDirectories.add(directoryRealPath);

    const directoryEntries = await readdir(directoryPath, { withFileTypes: true });
    directoryEntries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of directoryEntries) {
      if (!includeHidden && entry.name.startsWith(".")) {
        continue;
      }

      if (entries.length >= maxEntries) {
        truncated = true;
        break;
      }

      const absoluteEntryPath = path.join(directoryPath, entry.name);
      const entryStats = await lstat(absoluteEntryPath);
      const relativeEntryPath = normalizeSiteRelativePath(
        path.relative(target.siteRoot, absoluteEntryPath) || ".",
      );

      entries.push({
        path: relativeEntryPath,
        absolutePath: absoluteEntryPath,
        kind: classifyDirent(entryStats),
        sizeBytes: entryStats.size,
        modifiedAt: entryStats.mtime.toISOString(),
      });

      if (
        recursive &&
        entryStats.isDirectory() &&
        depth < maxDepth
      ) {
        await walkDirectory(absoluteEntryPath, depth + 1);
      }
    }
  }
}

export async function readSiteFile(
  selection: SiteSelection,
  options: {
    filePath: string;
    maxBytes?: number;
  },
) {
  const site = await resolveSite(selection);
  const target = await resolveSiteScopedPath(site.absolutePath, options.filePath);
  const fileStats = await stat(target.absolutePath);

  if (!fileStats.isFile()) {
    throw new Error(
      `The path '${target.relativePath}' is not a regular file inside the selected Local site.`,
    );
  }

  const maxBytes = clampSiteFileReadBytes(options.maxBytes);
  const buffer = await readFile(target.absolutePath);

  if (isLikelyBinaryBuffer(buffer)) {
    throw new Error(
      `The file '${target.relativePath}' looks binary. This tool is for text files only.`,
    );
  }

  const truncated = buffer.length > maxBytes;
  const excerptBuffer = truncated ? buffer.subarray(0, maxBytes) : buffer;
  const content = excerptBuffer.toString("utf8");

  return {
    site: summarizeSite(site),
    selectionMethod: site.selectionMethod,
    filePath: target.relativePath,
    absolutePath: target.absolutePath,
    sizeBytes: buffer.length,
    returnedBytes: excerptBuffer.length,
    maxBytes,
    truncated,
    content,
  };
}

export async function searchSiteFiles(
  selection: SiteSelection,
  options: {
    query: string;
    directoryPath?: string;
    caseSensitive?: boolean;
    includeHidden?: boolean;
    maxDepth?: number;
    maxMatches?: number;
  },
) {
  const site = await resolveSite(selection);
  const target = await resolveSiteScopedPath(
    site.absolutePath,
    options.directoryPath || ".",
    {
      allowSiteRoot: true,
    },
  );
  const targetStats = await lstat(target.absolutePath);

  if (!targetStats.isDirectory()) {
    throw new Error(
      `The path '${target.relativePath}' is not a directory inside the selected Local site.`,
    );
  }

  const query = options.query.trim();

  if (!query) {
    throw new Error("search_site_files requires a non-empty query.");
  }

  const caseSensitive = options.caseSensitive ?? false;
  const includeHidden = options.includeHidden ?? false;
  const maxDepth = Math.max(options.maxDepth ?? 10, 0);
  const maxMatches = clampSiteFileSearchMatches(options.maxMatches);
  const visitedDirectories = new Set<string>();
  const matches: Array<{
    path: string;
    absolutePath: string;
    line: number;
    column: number;
    excerpt: string;
  }> = [];
  let scannedFiles = 0;
  let skippedBinaryFiles = 0;
  let skippedLargeFiles = 0;
  let truncated = false;

  await walkDirectory(target.absolutePath, 0);

  return {
    site: summarizeSite(site),
    selectionMethod: site.selectionMethod,
    query,
    caseSensitive,
    directoryPath: target.relativePath,
    absoluteDirectoryPath: target.absolutePath,
    includeHidden,
    maxDepth,
    maxMatches,
    scannedFiles,
    skippedBinaryFiles,
    skippedLargeFiles,
    truncated,
    matches,
  };

  async function walkDirectory(directoryPath: string, depth: number) {
    if (matches.length >= maxMatches || depth > maxDepth) {
      if (matches.length >= maxMatches) {
        truncated = true;
      }
      return;
    }

    const directoryRealPath = await realpath(directoryPath);

    if (visitedDirectories.has(directoryRealPath)) {
      return;
    }

    visitedDirectories.add(directoryRealPath);

    const directoryEntries = await readdir(directoryPath, { withFileTypes: true });
    directoryEntries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of directoryEntries) {
      if (!includeHidden && entry.name.startsWith(".")) {
        continue;
      }

      if (matches.length >= maxMatches) {
        truncated = true;
        break;
      }

      const absoluteEntryPath = path.join(directoryPath, entry.name);
      const entryStats = await lstat(absoluteEntryPath);

      if (entryStats.isSymbolicLink()) {
        continue;
      }

      if (entryStats.isDirectory()) {
        if (depth < maxDepth) {
          await walkDirectory(absoluteEntryPath, depth + 1);
        }
        continue;
      }

      if (!entryStats.isFile()) {
        continue;
      }

      scannedFiles += 1;

      if (entryStats.size > SEARCH_FILE_SIZE_LIMIT) {
        skippedLargeFiles += 1;
        continue;
      }

      const buffer = await readFile(absoluteEntryPath);

      if (isLikelyBinaryBuffer(buffer)) {
        skippedBinaryFiles += 1;
        continue;
      }

      const content = buffer.toString("utf8");
      const contentToSearch = caseSensitive ? content : content.toLowerCase();
      const queryToSearch = caseSensitive ? query : query.toLowerCase();
      let startIndex = 0;

      while (matches.length < maxMatches) {
        const matchIndex = contentToSearch.indexOf(queryToSearch, startIndex);

        if (matchIndex === -1) {
          break;
        }

        const location = getLineAndColumn(content, matchIndex);
        const lineText = getLineText(content, location.line);

        matches.push({
          path: normalizeSiteRelativePath(
            path.relative(target.siteRoot, absoluteEntryPath) || ".",
          ),
          absolutePath: absoluteEntryPath,
          line: location.line,
          column: location.column,
          excerpt: lineText,
        });

        startIndex = matchIndex + Math.max(queryToSearch.length, 1);
      }

      if (matches.length >= maxMatches) {
        truncated = true;
        break;
      }
    }
  }
}

export async function writeSiteFile(
  selection: SiteSelection,
  options: {
    filePath: string;
    content: string;
    createDirectories?: boolean;
    overwrite?: boolean;
  },
) {
  assertFullAccessForSiteFiles("write_site_file");

  const site = await resolveSite(selection);
  const target = await resolveSiteScopedPath(site.absolutePath, options.filePath, {
    allowMissingTarget: true,
  });
  const targetStats = target.exists ? await lstat(target.absolutePath) : null;

  if (targetStats?.isDirectory()) {
    throw new Error(
      `The path '${target.relativePath}' is a directory. Use a file path instead.`,
    );
  }

  const overwrite = options.overwrite ?? true;

  if (target.exists && !overwrite) {
    throw new Error(
      `The file '${target.relativePath}' already exists. Set overwrite=true to replace it.`,
    );
  }

  const parentDirectory = path.dirname(target.absolutePath);
  const parentExists = await isReadablePath(parentDirectory);
  const createDirectories = options.createDirectories ?? true;
  let createdDirectories = false;

  if (!parentExists) {
    if (!createDirectories) {
      throw new Error(
        `The parent directory for '${target.relativePath}' does not exist.`,
      );
    }

    await mkdir(parentDirectory, { recursive: true });
    createdDirectories = true;
  }

  await writeFile(target.absolutePath, options.content, "utf8");

  return {
    site: summarizeSite(site),
    selectionMethod: site.selectionMethod,
    filePath: target.relativePath,
    absolutePath: target.absolutePath,
    existedBefore: target.exists,
    overwrite,
    createdDirectories,
    bytesWritten: Buffer.byteLength(options.content, "utf8"),
  };
}

export async function deleteSiteFile(
  selection: SiteSelection,
  options: {
    targetPath: string;
    recursive?: boolean;
    missingOk?: boolean;
  },
) {
  assertFullAccessForSiteFiles("delete_site_file");

  const site = await resolveSite(selection);
  const target = await resolveSiteScopedPath(site.absolutePath, options.targetPath, {
    allowSiteRoot: false,
    allowMissingTarget: true,
  });

  if (!target.exists) {
    if (options.missingOk) {
      return {
        site: summarizeSite(site),
        selectionMethod: site.selectionMethod,
        targetPath: target.relativePath,
        absolutePath: target.absolutePath,
        existedBefore: false,
        deleted: false,
        recursive: options.recursive ?? false,
        missingOk: true,
      };
    }

    throw new Error(
      `The path '${target.relativePath}' does not exist inside the selected Local site.`,
    );
  }

  const targetStats = await lstat(target.absolutePath);
  const recursive = options.recursive ?? false;

  await rm(target.absolutePath, {
    recursive,
    force: false,
  });

  return {
    site: summarizeSite(site),
    selectionMethod: site.selectionMethod,
    targetPath: target.relativePath,
    absolutePath: target.absolutePath,
    existedBefore: true,
    deleted: true,
    kind: classifyDirent(targetStats),
    recursive,
    missingOk: options.missingOk ?? false,
  };
}

export async function resolveSiteScopedPath(
  siteRoot: string,
  requestedPath: string,
  options: {
    allowSiteRoot?: boolean;
    allowMissingTarget?: boolean;
  } = {},
): Promise<ResolvedSiteFileTarget> {
  const trimmedPath = requestedPath.trim();
  const normalizedInput = trimmedPath || ".";
  const absolutePath = path.resolve(siteRoot, normalizedInput);
  const relativePath = normalizeSiteRelativePath(
    path.relative(siteRoot, absolutePath) || ".",
  );

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(
      `The path '${requestedPath}' points outside the selected Local site.`,
    );
  }

  if (!options.allowSiteRoot && relativePath === ".") {
    throw new Error("Refusing to operate on the Local site root directory itself.");
  }

  const siteRootReal = await realpath(siteRoot);
  const exists = await isReadablePath(absolutePath);
  const anchorPath = exists
    ? absolutePath
    : await findNearestExistingAncestor(absolutePath, siteRoot);

  if (!anchorPath) {
    throw new Error(
      `The path '${requestedPath}' does not exist inside the selected Local site.`,
    );
  }

  const anchorRealPath = await realpath(anchorPath);

  if (!isPathWithinBase(siteRootReal, anchorRealPath)) {
    throw new Error(
      `The path '${requestedPath}' resolves outside the selected Local site.`,
    );
  }

  if (!exists && !options.allowMissingTarget) {
    throw new Error(
      `The path '${requestedPath}' does not exist inside the selected Local site.`,
    );
  }

  return {
    siteRoot,
    siteRootReal,
    absolutePath,
    relativePath,
    exists,
  };
}

async function findNearestExistingAncestor(
  absolutePath: string,
  siteRoot: string,
): Promise<string | null> {
  let currentPath = absolutePath;

  while (true) {
    if (await isReadablePath(currentPath)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);

    if (currentPath === parentPath) {
      return null;
    }

    if (path.relative(siteRoot, parentPath).startsWith("..")) {
      return null;
    }

    currentPath = parentPath;
  }
}

function isPathWithinBase(basePath: string, candidatePath: string) {
  const relativePath = path.relative(basePath, candidatePath);
  return (
    relativePath === "" ||
    relativePath === "." ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function classifyDirent(fileStats: Awaited<ReturnType<typeof lstat>>) {
  if (fileStats.isFile()) {
    return "file" as const;
  }

  if (fileStats.isDirectory()) {
    return "directory" as const;
  }

  if (fileStats.isSymbolicLink()) {
    return "symlink" as const;
  }

  return "other" as const;
}

function isLikelyBinaryBuffer(buffer: Buffer) {
  return buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0);
}

function getLineAndColumn(content: string, index: number) {
  let line = 1;
  let column = 1;

  for (let cursor = 0; cursor < index; cursor += 1) {
    if (content[cursor] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function getLineText(content: string, lineNumber: number) {
  const lines = content.split(/\r?\n/);
  return lines[Math.max(lineNumber - 1, 0)] || "";
}

function assertFullAccessForSiteFiles(toolName: string) {
  if (config.profile !== "full-access") {
    throw new Error(
      `${toolName} requires LOCALWP_MCP_PROFILE=full-access.`,
    );
  }
}
