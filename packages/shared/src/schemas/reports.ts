import { z } from "zod";
import { uuidSchema } from "./common.ts";

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** S-09.8 — close a fiscal period so nobody back-dates entries into it. `startDate`/`endDate` are inclusive. */
export const createFiscalPeriodSchema = z.object({
  startDate: dateStringSchema,
  endDate: dateStringSchema,
});

/** S-09.9 — a custom, org-defined account extending the seeded chart of accounts. System accounts are seeded server-side only; this is always `isSystem: false`. */
export const createAccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["asset", "liability", "equity", "income", "expense"]),
  parentId: uuidSchema.optional(),
});
