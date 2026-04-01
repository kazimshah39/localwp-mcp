import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolvePackageVersion() {
  if (process.env.npm_package_version) {
    return process.env.npm_package_version;
  }

  const currentFilePath = fileURLToPath(import.meta.url);
  const packageJsonPath = path.resolve(
    path.dirname(currentFilePath),
    "..",
    "package.json",
  );

  try {
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, "utf8"),
    ) as { version?: unknown };

    if (typeof packageJson.version === "string" && packageJson.version.trim()) {
      return packageJson.version;
    }
  } catch {
    // Fall through to the hard-coded safety net below.
  }

  return "0.1.0";
}
