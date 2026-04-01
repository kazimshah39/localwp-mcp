import { config } from "./config.js";
import { filterReadableDirectories, findFirstReadablePath } from "./process-utils.js";
import type { ResolvedLocalTooling } from "./types.js";

let toolingPromise: Promise<ResolvedLocalTooling> | null = null;

export function resolveLocalTooling() {
  if (!toolingPromise) {
    toolingPromise = loadLocalTooling();
  }

  return toolingPromise;
}

async function loadLocalTooling() {
  const wpCliPhar = await findFirstReadablePath(config.localWpCliPharCandidates);

  if (!wpCliPhar) {
    throw new Error(
      `Could not find wp-cli.phar. Checked: ${config.localWpCliPharCandidates.join(", ")}`,
    );
  }

  const wpCliConfig = await findFirstReadablePath(config.localWpCliConfigCandidates);
  const helperBinDirs = await filterReadableDirectories(
    config.localHelperBinDirCandidates,
  );

  return {
    wpCliPhar,
    wpCliConfig,
    helperBinDirs,
  } satisfies ResolvedLocalTooling;
}
