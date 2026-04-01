import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultLocalAppSupportDir,
  getDefaultLocalExtraResourcesDirs,
  getExecutableCandidates,
  getLegacySiteBinariesDirs,
  getLightningServiceBinaryCandidates,
  getPlatformBinDirCandidates,
  getWpCliPharCandidates,
} from "../src/platform-paths.ts";

test("getDefaultLocalAppSupportDir returns platform-specific Local metadata roots", () => {
  assert.equal(
    getDefaultLocalAppSupportDir("darwin", "/Users/alex", {}),
    "/Users/alex/Library/Application Support/Local",
  );
  assert.equal(
    getDefaultLocalAppSupportDir("linux", "/home/alex", {}),
    "/home/alex/.config/Local",
  );
  assert.equal(
    getDefaultLocalAppSupportDir("win32", "C:\\Users\\Alex", {
      APPDATA: "C:\\Users\\Alex\\AppData\\Roaming",
    }),
    "C:\\Users\\Alex\\AppData\\Roaming\\Local",
  );
});

test("getDefaultLocalExtraResourcesDirs returns sensible install candidates", () => {
  assert.deepEqual(getDefaultLocalExtraResourcesDirs("darwin", "/Users/alex", {}), [
    "/Applications/Local.app/Contents/Resources/extraResources",
  ]);
  assert.deepEqual(getDefaultLocalExtraResourcesDirs("linux", "/home/alex", {}), [
    "/opt/Local/resources/extraResources",
  ]);

  const windowsDirs = getDefaultLocalExtraResourcesDirs("win32", "C:\\Users\\Alex", {
    LOCALAPPDATA: "C:\\Users\\Alex\\AppData\\Local",
    "ProgramFiles(x86)": "C:\\Program Files (x86)",
    ProgramFiles: "C:\\Program Files",
  });

  assert.equal(windowsDirs[0], "C:\\Users\\Alex\\AppData\\Local\\Programs\\Local\\resources\\extraResources");
  assert.ok(windowsDirs.includes("C:\\Program Files (x86)\\Local\\resources\\extraResources"));
  assert.ok(windowsDirs.includes("C:\\Program Files\\Local\\resources\\extraResources"));
});

test("getLegacySiteBinariesDirs matches older Local layouts", () => {
  assert.deepEqual(
    getLegacySiteBinariesDirs("darwin", ["/Applications/Local.app/Contents/Resources/extraResources"]),
    ["/Applications/Local.app/Contents/Resources/extraResources/site-binaries"],
  );
  assert.deepEqual(
    getLegacySiteBinariesDirs("linux", ["/opt/Local/resources/extraResources"]),
    ["/opt/Local/resources/extraResources/site-binaries-linux"],
  );
  assert.deepEqual(
    getLegacySiteBinariesDirs("win32", ["C:\\Local\\resources\\extraResources"]),
    ["C:\\Local\\resources\\extraResources\\site-binaries-win32"],
  );
});

test("getPlatformBinDirCandidates prefers native directories", () => {
  assert.deepEqual(getPlatformBinDirCandidates("darwin", "arm64"), [
    "darwin-arm64",
    "darwin",
  ]);
  assert.deepEqual(getPlatformBinDirCandidates("win32", "x64"), [
    "win64",
    "win32",
  ]);
  assert.deepEqual(getPlatformBinDirCandidates("linux", "x64"), [
    "linux",
    "linux-arm64",
  ]);
});

test("getExecutableCandidates adds .exe on Windows only", () => {
  assert.deepEqual(getExecutableCandidates("php", "darwin"), ["php"]);
  assert.deepEqual(getExecutableCandidates("php", "linux"), ["php"]);
  assert.deepEqual(getExecutableCandidates("php", "win32"), ["php.exe", "php"]);
});

test("getLightningServiceBinaryCandidates supports direct and nested bin layouts", () => {
  assert.deepEqual(
    getLightningServiceBinaryCandidates(
      "C:\\Local\\lightning-services\\php-8.2.23+0\\bin\\win64",
      "php.exe",
    ),
    [
      "C:\\Local\\lightning-services\\php-8.2.23+0\\bin\\win64\\php.exe",
      "C:\\Local\\lightning-services\\php-8.2.23+0\\bin\\win64\\bin\\php.exe",
    ],
  );
  assert.deepEqual(
    getLightningServiceBinaryCandidates(
      "/opt/Local/lightning-services/php-8.2.23+0/bin/darwin",
      "php",
    ),
    [
      "/opt/Local/lightning-services/php-8.2.23+0/bin/darwin/php",
      "/opt/Local/lightning-services/php-8.2.23+0/bin/darwin/bin/php",
    ],
  );
});

test("getWpCliPharCandidates includes current and legacy Local layouts", () => {
  const macCandidates = getWpCliPharCandidates("darwin", [
    "/Applications/Local.app/Contents/Resources/extraResources",
  ]);
  assert.ok(
    macCandidates.includes(
      "/Applications/Local.app/Contents/Resources/extraResources/bin/wp-cli/wp-cli.phar",
    ),
  );
  assert.ok(
    macCandidates.includes(
      "/Applications/Local.app/Contents/Resources/extraResources/site-binaries/wp-cli/wp-cli.phar",
    ),
  );

  const windowsCandidates = getWpCliPharCandidates("win32", [
    "C:\\Local\\resources\\extraResources",
  ]);
  assert.ok(
    windowsCandidates.includes(
      "C:\\Local\\resources\\extraResources\\bin\\wp-cli\\wp-cli.phar",
    ),
  );
  assert.ok(
    windowsCandidates.includes(
      "C:\\Local\\resources\\extraResources\\site-binaries-win32\\wp-cli.phar",
    ),
  );
});
