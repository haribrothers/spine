import { z } from "zod";

/** US-INV-16 — the "How customers can pay" block is at most this long. */
export const PAYMENT_INSTRUCTIONS_MAX = 600;
export const PAYMENT_INSTRUCTIONS_TOO_LONG = "Keep this under 600 characters.";

/**
 * The `business_profile` setting. Loose on purpose (`passthrough`): it only
 * guards the fields with rules, and keeps whatever else is stored.
 */
/** US-INV-25 (D-150) — a UPI ID: "name@bank", no spaces. */
export const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$/;
export const UPI_ID_INVALID = "Enter a UPI ID like name@bank.";

export const businessProfileSchema = z
  .object({
    name: z.string().optional(),
    logoUrl: z.string().optional(),
    address: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    industry: z.string().optional(),
    paymentInstructions: z.string().max(PAYMENT_INSTRUCTIONS_MAX, PAYMENT_INSTRUCTIONS_TOO_LONG).optional(),
    /** US-INV-25 (D-150) — customers pay INR invoices to this UPI ID by scanning the invoice's QR code. */
    upiId: z.string().trim().regex(UPI_ID_PATTERN, UPI_ID_INVALID).optional(),
    /** The name a UPI app shows; the business name when blank. */
    upiPayeeName: z.string().trim().max(100, "Keep the payee name under 100 characters.").optional(),
    /** On by default once a UPI ID is saved. */
    showUpiQr: z.boolean().optional(),
  })
  .passthrough();

export type BusinessProfile = z.infer<typeof businessProfileSchema>;

/**
 * US-INV-26 (D-150) — what an invoice's UPI QR code encodes:
 * `upi://pay?pa=<UPI ID>&pn=<payee>&am=<amount>&cu=INR&tn=<invoice number>`.
 * `amount` is in paise.
 */
export function upiPaymentUri(input: { upiId: string; payeeName: string; amount: bigint; note: string }): string {
  const rupees = `${input.amount / 100n}.${String(input.amount % 100n).padStart(2, "0")}`;
  const params = [
    ["pa", input.upiId],
    ["pn", input.payeeName],
    ["am", rupees],
    ["cu", "INR"],
    ["tn", input.note],
  ];
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join("&")}`;
}

/**
 * US-INV-26 (D-150) — what an invoice's UPI QR code asks for: its balance
 * due, when the invoice is in rupees, a UPI ID is saved, "Show a UPI QR code
 * on invoices" is on (the default once an ID is saved), and something is due.
 * Null means no QR code.
 */
export function upiQrAmountFor(
  profile: { upiId?: string | null; showUpiQr?: boolean | null } | null | undefined,
  currency: string,
  balanceDue: bigint,
): bigint | null {
  if (currency !== "INR" || !profile?.upiId?.trim() || profile.showUpiQr === false || balanceDue <= 0n) return null;
  return balanceDue;
}
