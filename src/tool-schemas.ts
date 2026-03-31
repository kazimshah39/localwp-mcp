import { z } from "zod";

export const siteSelectorSchema = {
  siteId: z
    .string()
    .optional()
    .describe("Optional Local site ID, for example 'pAqtzqnWM'."),
  siteName: z
    .string()
    .optional()
    .describe("Optional Local site name, for example 'plovercrm'."),
};

export const logScopeSchema = z
  .enum(["site", "global", "all"])
  .optional()
  .describe(
    "Which logs to read: the selected site's logs, Local's app logs, or both.",
  );

export const backupScopeSchema = z
  .enum(["database", "full"])
  .optional()
  .describe(
    "Backup only the database, or create a full Local-style backup with app, conf, logs, and a fresh SQL export.",
  );
