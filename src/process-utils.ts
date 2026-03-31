import { spawn } from "child_process";
import { constants as fsConstants, createReadStream } from "fs";
import { access } from "fs/promises";

import { config } from "./config.js";
import type { SpawnResult } from "./types.js";

export async function assertReadable(filePath: string, message: string) {
  if (!(await isReadablePath(filePath))) {
    throw new Error(`${message}: ${filePath}`);
  }
}

export async function ensureReadableDirectory(
  directoryPath: string,
  message: string,
) {
  if (!(await isReadablePath(directoryPath))) {
    throw new Error(`${message}: ${directoryPath}`);
  }
}

export async function ensureExecutable(filePath: string, message: string) {
  if (!(await isExecutablePath(filePath))) {
    throw new Error(`${message}: ${filePath}`);
  }
}

export async function isReadablePath(filePath: string) {
  try {
    await access(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isExecutablePath(filePath: string) {
  try {
    await access(
      filePath,
      process.platform === "win32" ? fsConstants.R_OK : fsConstants.X_OK,
    );
    return true;
  } catch {
    return false;
  }
}

export async function filterReadableDirectories(paths: string[]) {
  const readableDirectories: string[] = [];

  for (const candidate of paths) {
    if (await isReadablePath(candidate)) {
      readableDirectories.push(candidate);
    }
  }

  return readableDirectories;
}

export async function findFirstReadablePath(paths: string[]) {
  for (const candidate of paths) {
    if (await isReadablePath(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function spawnCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    stdinFilePath?: string;
  },
) {
  return new Promise<SpawnResult>((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      shell: false,
      stdio: [options.stdinFilePath ? "pipe" : "ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, config.defaultTimeoutMs);

    const stdoutStream = child.stdout;
    const stderrStream = child.stderr;
    const stdinStream = child.stdin;

    if (!stdoutStream || !stderrStream) {
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Failed to capture stdio for '${command}'.`));
      return;
    }

    stdoutStream.setEncoding("utf8");
    stderrStream.setEncoding("utf8");

    stdoutStream.on("data", (chunk: string) => {
      stdout += chunk;
    });

    stderrStream.on("data", (chunk: string) => {
      stderr += chunk;
    });

    if (options.stdinFilePath) {
      const inputStream = createReadStream(options.stdinFilePath);

      inputStream.on("error", (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        reject(error);
      });

      if (!stdinStream) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to open stdin for '${command}'.`));
        return;
      }

      inputStream.pipe(stdinStream);
    }

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve({
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: exitCode ?? 0,
        timedOut,
      });
    });
  });
}
