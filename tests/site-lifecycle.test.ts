import assert from "node:assert/strict";
import test from "node:test";

import { formatLocalGraphqlErrors } from "../src/local-graphql.ts";
import { planSiteLifecycleAction } from "../src/site-lifecycle.ts";

test("planSiteLifecycleAction treats start on a running site as a no-op", () => {
  assert.deepEqual(planSiteLifecycleAction("start", "running"), {
    noOp: true,
    performedActions: [],
  });
});

test("planSiteLifecycleAction treats stop on a halted site as a no-op", () => {
  assert.deepEqual(planSiteLifecycleAction("stop", "halted"), {
    noOp: true,
    performedActions: [],
  });
});

test("planSiteLifecycleAction restarts running sites by stopping then starting", () => {
  assert.deepEqual(planSiteLifecycleAction("restart", "running"), {
    noOp: false,
    performedActions: ["stop", "start"],
  });
});

test("planSiteLifecycleAction starts halted sites on restart", () => {
  assert.deepEqual(planSiteLifecycleAction("restart", "halted"), {
    noOp: false,
    performedActions: ["start"],
  });
});

test("formatLocalGraphqlErrors joins multiple messages", () => {
  assert.equal(
    formatLocalGraphqlErrors([
      { message: "First problem" },
      { message: "Second problem" },
    ]),
    "First problem; Second problem",
  );
});
