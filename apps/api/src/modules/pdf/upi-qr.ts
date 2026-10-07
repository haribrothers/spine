import QRCode from "qrcode";
import { upiPaymentUri, upiQrAmountFor } from "@spine/shared";

/** The "How to pay" block's UPI QR code (US-INV-26). */
export interface UpiQr {
  dataUri: string;
  amount: bigint;
  upiId: string;
  note: string;
}

interface UpiProfile {
  name?: string;
  upiId?: string;
  upiPayeeName?: string;
  showUpiQr?: boolean;
}

type UpiInvoice = { status: string; number: string | null; currency: string; upiQrAmount: bigint | null; balanceDue: bigint };

/**
 * US-INV-26 (D-150) — what an invoice's QR code says, or null for none. An
 * issued invoice asks for the balance due when it was issued (`upiQrAmount`,
 * null when it had none); a draft previews what issuing it now would print.
 * The code is a `upi://pay` link with the payee, the amount and the invoice
 * number as the note.
 */
export function upiQrFor(invoice: UpiInvoice, profile: UpiProfile | null | undefined): (Omit<UpiQr, "dataUri"> & { uri: string }) | null {
  const amount = invoice.status === "draft" ? upiQrAmountFor(profile, invoice.currency, invoice.balanceDue) : invoice.upiQrAmount;
  const upiId = profile?.upiId?.trim();
  if (amount === null || amount <= 0n || !upiId) return null;
  const note = invoice.number ?? "Draft invoice";
  const uri = upiPaymentUri({ upiId, payeeName: profile?.upiPayeeName?.trim() || profile?.name?.trim() || upiId, amount, note });
  return { uri, amount, upiId, note };
}

/** The QR code as a PNG, for the PDF — which, once issued, is stored and never changes (D-083). */
export async function loadUpiQr(invoice: UpiInvoice, profile: UpiProfile | null | undefined): Promise<UpiQr | null> {
  const qr = upiQrFor(invoice, profile);
  if (!qr) return null;
  const dataUri = await QRCode.toDataURL(qr.uri, { errorCorrectionLevel: "M", margin: 1, width: 240 });
  return { dataUri, amount: qr.amount, upiId: qr.upiId, note: qr.note };
}
