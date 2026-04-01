import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { expandHome } from "../src/local-sites.ts";

test("expandHome supports forward-slash home paths", () => {
  assert.equal(
    expandHome("~/Local Sites/test-1"),
    path.join(os.homedir(), "Local Sites", "test-1"),
  );
});

test("expandHome supports backslash home paths from Windows Local metadata", () => {
  assert.equal(
    expandHome("~\\Local Sites\\test-1"),
    path.join(os.homedir(), "Local Sites", "test-1"),
  );
});
