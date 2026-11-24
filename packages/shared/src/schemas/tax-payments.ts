import { z } from "zod";

/** US-TAX-08 (D-143) — tax paid to the authority (P26) or refunded by it (P27). */
export const TAX_PAYMENT_KINDS = ["payment", "refund"] as const;
export type TaxPaymentKind = (typeof TAX_PAYMENT_KINDS)[number];

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-05.");
const reference = z
  .string()
  .trim()
  .max(120, "Use 120 characters or fewer for the reference.")
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

/** `POST /tax-payments`. `amount` is what left the money account; `inputTaxUsed` is the input tax credit set against the tax collected. */
export const createTaxPaymentSchema = z
  .object({
    periodFrom: isoDateSchema,
    periodTo: isoDateSchema,
    inputTaxUsed: z.coerce.bigint().nonnegative("Input tax used can't be negative."),
    amount: z.coerce.bigint().nonnegative("Amount paid can't be negative."),
    moneyAccountId: z.string().uuid("Choose the account you paid from.").optional().nullable().transform((v) => v ?? null),
    date: isoDateSchema,
    reference,
  })
  .refine((v) => v.periodFrom <= v.periodTo, { message: "The period has to end after it starts.", path: ["periodTo"] })
  .refine((v) => v.amount + v.inputTaxUsed > 0n, { message: "Enter the amount paid or the input tax used.", path: ["amount"] })
  .refine((v) => v.amount === 0n || v.moneyAccountId, { message: "Choose the account you paid from.", path: ["moneyAccountId"] });
export type CreateTaxPaymentInput = z.infer<typeof createTaxPaymentSchema>;

/** `POST /tax-refunds`: input tax the authority paid back. */
export const createTaxRefundSchema = z.object({
  amount: z.coerce.bigint().positive("Enter an amount greater than zero."),
  moneyAccountId: z.string().uuid("Choose the account the refund went to."),
  date: isoDateSchema,
  reference,
});
export type CreateTaxRefundInput = z.infer<typeof createTaxRefundSchema>;

export const taxPaymentListQuerySchema = z.object({ from: isoDateSchema.optional(), to: isoDateSchema.optional() });

/** More input tax used (or refunded) than 1200 Input Tax Receivable holds on the date. */
export const inputTaxOverMessage = (available: string) => `You have ${available} of input tax to use. Lower the amount.`;

export interface TaxPayment {
  id: string;
  kind: TaxPaymentKind;
  periodFrom: string | null;
  periodTo: string | null;
  /** Minor units as strings. */
  inputTaxUsed: string;
  amount: string;
  moneyAccount: { id: string; name: string } | null;
  date: string;
  reference: string | null;
  deletedAt: string | null;
}
