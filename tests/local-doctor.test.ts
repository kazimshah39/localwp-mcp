import assert from "node:assert/strict";
import test from "node:test";

import { summarizeDoctorStatus } from "../src/local-doctor.ts";

test("summarizeDoctorStatus reports the highest-severity result", () => {
  assert.equal(
    summarizeDoctorStatus([
      { id: "a", status: "ok", title: "A", message: "ok" },
      { id: "b", status: "warning", title: "B", message: "warn" },
    ]),
    "warning",
  );

  assert.equal(
    summarizeDoctorStatus([
      { id: "a", status: "ok", title: "A", message: "ok" },
      { id: "b", status: "error", title: "B", message: "error" },
    ]),
    "error",
  );
});
