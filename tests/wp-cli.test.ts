import assert from "node:assert/strict";
import test from "node:test";

import { tokenizeCommand } from "../src/wp-cli.ts";

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
