import assert from "node:assert/strict";
import test from "node:test";

import {
  clampMaxRows,
  validateFullAccessSql,
  validateSafeSqlQuery,
} from "../src/mysql.ts";

test("validateSafeSqlQuery normalizes a commented single statement", () => {
  const sql = validateSafeSqlQuery(`
    -- report query
    SELECT * FROM wp_posts;
  `);

  assert.equal(sql, "SELECT * FROM wp_posts");
});

test("validateSafeSqlQuery rejects multiple statements", () => {
  assert.throws(() => validateSafeSqlQuery("SELECT 1; SELECT 2;"));
});

test("validateSafeSqlQuery rejects write queries", () => {
  assert.throws(() =>
    validateSafeSqlQuery("UPDATE wp_options SET option_value = 'x'"),
  );
});

test("validateFullAccessSql allows write queries", () => {
  assert.equal(
    validateFullAccessSql("UPDATE wp_options SET option_value = 'x'"),
    "UPDATE wp_options SET option_value = 'x'",
  );
});

test("validateFullAccessSql blocks file access SQL features", () => {
  assert.throws(() =>
    validateFullAccessSql("SELECT * INTO OUTFILE '/tmp/export.csv' FROM wp_posts"),
  );
});

test("clampMaxRows respects defaults and upper bounds", () => {
  assert.equal(clampMaxRows(undefined), 200);
  assert.equal(clampMaxRows(10), 10);
  assert.equal(clampMaxRows(5000), 1000);
});
