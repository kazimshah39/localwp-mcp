import assert from "node:assert/strict";
import test from "node:test";

import {
  assertWpCliProcessSucceeded,
  formatWpCliProcessError,
  tokenizeCommand,
} from "../src/wp-cli.ts";

test("tokenizeCommand splits plain arguments", () => {
  assert.deepEqual(tokenizeCommand("plugin list --format=json"), [
    "plugin",
    "list",
    "--format=json",
  ]);
});

test("tokenizeCommand preserves quoted arguments", () => {
  assert.deepEqual(tokenizeCommand("post create --post_title='Hello World'"), [
    "post",
    "create",
    "--post_title=Hello World",
  ]);
});

test("tokenizeCommand rejects malformed input", () => {
  assert.throws(() => tokenizeCommand("plugin list 'unterminated"));
});

test("formatWpCliProcessError includes stdout and stderr details", () => {
  const message = formatWpCliProcessError(
    {
      site: {
        name: "example-site",
      },
    } as never,
    {
      exitCode: 255,
      stdout: "marker payload",
      stderr: "fatal warning",
      timedOut: false,
    },
  );

  assert.match(message, /example-site/);
  assert.match(message, /marker payload/);
  assert.match(message, /fatal warning/);
});

test("assertWpCliProcessSucceeded throws on nonzero exit codes", () => {
  assert.throws(() =>
    assertWpCliProcessSucceeded(
      {
        site: {
          name: "example-site",
        },
      } as never,
      {
        exitCode: 255,
        stdout: "marker payload",
        stderr: "",
        timedOut: false,
      },
    ),
  );
});
