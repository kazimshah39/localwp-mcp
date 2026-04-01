import path from "path";

export function dedupePaths(paths: string[]) {
  return [...new Set(paths.filter(Boolean))];
}

function getPathApi(platform: NodeJS.Platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

export function getDefaultLocalAppSupportDir(
  platform: NodeJS.Platform,
  homeDir: string,
  env: NodeJS.ProcessEnv,
) {
  const pathApi = getPathApi(platform);

  if (platform === "win32") {
    return pathApi.join(
      env.APPDATA || pathApi.join(homeDir, "AppData", "Roaming"),
      "Local",
    );
  }

  if (platform === "linux") {
    return pathApi.join(
      env.XDG_CONFIG_HOME || pathApi.join(homeDir, ".config"),
      "Local",
    );
  }

  return pathApi.join(homeDir, "Library", "Application Support", "Local");
}

export function getDefaultLocalExtraResourcesDirs(
  platform: NodeJS.Platform,
  homeDir: string,
  env: NodeJS.ProcessEnv,
) {
  const pathApi = getPathApi(platform);

  if (platform === "win32") {
    return dedupePaths([
      pathApi.join(
        env.LOCALAPPDATA || pathApi.join(homeDir, "AppData", "Local"),
        "Programs",
        "Local",
        "resources",
        "extraResources",
      ),
      pathApi.join(
        env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
        "Local",
        "resources",
        "extraResources",
      ),
      pathApi.join(
        env.ProgramFiles || "C:\\Program Files",
        "Local",
        "resources",
        "extraResources",
      ),
    ]);
  }

  if (platform === "linux") {
    return ["/opt/Local/resources/extraResources"];
  }

  return ["/Applications/Local.app/Contents/Resources/extraResources"];
}

export function getDefaultLocalLightningServiceDirs(
  localAppSupportDir: string,
  extraResourcesDirs: string[],
) {
  return dedupePaths([
    path.join(localAppSupportDir, "lightning-services"),
    ...extraResourcesDirs.map((directory) => {
      const pathApi = directory.includes("\\") ? path.win32 : path.posix;
      return pathApi.join(directory, "lightning-services");
    }),
  ]);
}

function joinPlatformPath(basePath: string, ...parts: string[]) {
  const pathApi = basePath.includes("\\") ? path.win32 : path.posix;
  return pathApi.join(basePath, ...parts);
}

export function getLegacySiteBinariesDirs(
  platform: NodeJS.Platform,
  extraResourcesDirs: string[],
) {
  const directoryName =
    platform === "win32"
      ? "site-binaries-win32"
      : platform === "linux"
        ? "site-binaries-linux"
        : "site-binaries";

  return dedupePaths(
    extraResourcesDirs.map((directory) => joinPlatformPath(directory, directoryName)),
  );
}

export function getWpCliPharCandidates(
  platform: NodeJS.Platform,
  extraResourcesDirs: string[],
) {
  const legacySiteBinariesDirs = getLegacySiteBinariesDirs(
    platform,
    extraResourcesDirs,
  );

  return dedupePaths([
    ...extraResourcesDirs.map((directory) =>
      joinPlatformPath(directory, "bin", "wp-cli", "wp-cli.phar"),
    ),
    ...legacySiteBinariesDirs.map((directory) =>
      platform === "darwin"
        ? joinPlatformPath(directory, "wp-cli", "wp-cli.phar")
        : joinPlatformPath(directory, "wp-cli.phar"),
    ),
  ]);
}

export function getWpCliConfigCandidates(extraResourcesDirs: string[]) {
  return dedupePaths(
    extraResourcesDirs.map((directory) =>
      joinPlatformPath(directory, "bin", "wp-cli", "config.yaml"),
    ),
  );
}

export function getHelperBinDirCandidates(
  platform: NodeJS.Platform,
  extraResourcesDirs: string[],
) {
  const platformSpecificHelperDirs =
    platform === "win32"
      ? [
          ["bin", "composer", "win32"],
          ["bin", "wp-cli", "win32"],
        ]
      : [
          ["bin", "composer", "posix"],
          ["bin", "wp-cli", "posix"],
        ];

  return dedupePaths(
    extraResourcesDirs.flatMap((directory) => [
      joinPlatformPath(directory, "bin"),
      ...platformSpecificHelperDirs.map((parts) =>
        joinPlatformPath(directory, ...parts),
      ),
    ]),
  );
}

export function getPlatformBinDirCandidates(
  platform: NodeJS.Platform,
  arch: string,
) {
  if (platform === "win32") {
    return arch === "x64" ? ["win64", "win32"] : ["win32", "win64"];
  }

  if (platform === "linux") {
    return arch === "arm64" ? ["linux-arm64", "linux"] : ["linux", "linux-arm64"];
  }

  return arch === "arm64" ? ["darwin-arm64", "darwin"] : ["darwin", "darwin-arm64"];
}

export function getExecutableCandidates(
  binaryName: string,
  platform: NodeJS.Platform,
) {
  if (platform === "win32") {
    return [`${binaryName}.exe`, binaryName];
  }

  return [binaryName];
}

export function getLightningServiceBinaryCandidates(
  platformDirPath: string,
  executableName: string,
  platform?: NodeJS.Platform,
) {
  const nestedPath = joinPlatformPath(platformDirPath, "bin", executableName);
  const directPath = joinPlatformPath(platformDirPath, executableName);

  if (platform === "win32") {
    return dedupePaths([directPath, nestedPath]);
  }

  return dedupePaths([nestedPath, directPath]);
}
