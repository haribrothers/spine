import { Inject, Injectable } from "@nestjs/common";
import { renderToBuffer } from "@react-pdf/renderer";
import { resolveDocumentBranding, resolveDocumentLayout, type DocumentLayout, type DocumentType, type TaxProfile } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { orgMoneySettings } from "../../common/money-format";
import { SettingsService } from "../org/settings.service";
import { CreditNotePdfDocument } from "./credit-note-pdf.template";
import { InvoicePdfDocument, type InvoicePdfBusinessProfile } from "./invoice-pdf.template";
import { PaymentPdfDocument } from "./payment-pdf.template";
import { QuotePdfDocument } from "./quote-pdf.template";
import { StatementPdfDocument } from "../statements/statement-pdf.template";

const NOW = new Date("2026-10-05T10:00:00Z");

/** Two sample lines — one with a discount — and a heading, in minor units. */
function sampleLines(currency: string) {
  const base = { unitPriceCurrency: currency, catalogItemId: null, taxRateId: null, taxGroupId: null, isTaxInclusive: false, supplyClass: "taxable", createdAt: NOW, updatedAt: NOW };
  return [
    { ...base, id: "h", sortOrder: 0, type: "heading", name: "Kitchen", description: null, quantity: 0, unitPriceAmount: 0n, discountPercentage: 0, taxRatePercentage: 0, lineSubtotalAmount: 0n, lineTaxAmount: 0n, lineTotalAmount: 0n, hsnSac: null, supplyClass: null },
    { ...base, id: "a", sortOrder: 1, type: "item", name: "Modular kitchen", description: "Carcass, shutters and fittings", quantity: 1, unitPriceAmount: 18000000n, discountPercentage: 0, taxRatePercentage: 18, lineSubtotalAmount: 18000000n, lineTaxAmount: 3240000n, lineTotalAmount: 21240000n, hsnSac: "9403" },
    { ...base, id: "b", sortOrder: 2, type: "item", name: "Installation", description: "Levelling and handover", quantity: 2, unitPriceAmount: 1250000n, discountPercentage: 10, taxRatePercentage: 18, lineSubtotalAmount: 2250000n, lineTaxAmount: 405000n, lineTotalAmount: 2655000n, hsnSac: "995472" },
  ];
}

const TOTALS = { subtotalAmount: 20500000n, discountAmount: 250000n, taxAmount: 3645000n, totalAmount: 23895000n };

/**
 * US-SET-17 — renders a sample of a document type with layout options that
 * haven't been saved yet, for the live preview in Settings › Documents.
 * Uses the business's name, logo-free branding, currency and locale, and
 * made-up lines; nothing is stored.
 */
@Injectable()
export class DocumentPreviewService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
  ) {}

  async render(orgId: string, type: DocumentType, input: DocumentLayout): Promise<Buffer> {
    const layout = resolveDocumentLayout(input, type);
    const business = (await this.settings.get<InvoicePdfBusinessProfile>(orgId, "business_profile")) ?? { name: "Your business" };
    const branding = resolveDocumentBranding(await this.settings.get(orgId, "branding"));
    const { currency, locale } = await orgMoneySettings(this.db, orgId);
    const profile = (await this.settings.get<TaxProfile>(orgId, "tax_profile")) ?? {};
    const gst = profile.country === "IN" && typeof profile.stateCode === "string";
    const lines = sampleLines(currency) as never;
    const common = { business, branding, locale, layout, contactName: "Lakeview Homes", contactEmail: "accounts@lakeview.example" };
    // A GST business previews its GST columns (US-TAX-15): the documents carry a supply type.
    const supply = { placeOfSupply: gst ? (profile.stateCode as string) : null, supplyType: gst ? ("intra" as const) : null };

    switch (type) {
      case "quote":
        return renderToBuffer(QuotePdfDocument({ ...common, lines, quote: { id: "q", number: "QUO-0042", version: 1, status: "sent", currency, validUntil: "2026-11-04", createdAt: NOW, sentAt: NOW, notes: layout.notes || null, termsAndConditions: layout.terms || null, ...supply, ...TOTALS } as never }));
      case "invoice":
        return renderToBuffer(
          InvoicePdfDocument({
            ...common,
            lines,
            invoice: { id: "i", number: "INV-0142", type: "standard", status: "issued", currency, issueDate: "2026-10-05", dueDate: "2026-10-20", issuedAt: NOW, createdAt: NOW, amountPaid: 0n, creditedAmount: 0n, retentionAmount: 0n, paymentInstructions: business.paymentInstructions ?? null, notes: layout.notes || null, termsAndConditions: layout.terms || null, ...supply, ...TOTALS } as never,
          }),
        );
      case "credit_note":
        return renderToBuffer(
          CreditNotePdfDocument({
            ...common,
            lines: (lines as { discountPercentage: number }[]).map((l) => ({ ...l, discountPercentage: undefined })) as never,
            invoiceNumber: "INV-0142",
            creditNote: { id: "c", number: "CN-0007", status: "issued", currency, date: "2026-10-12", issuedAt: NOW, createdAt: NOW, reason: "Two cabinet doors returned", ...supply, ...TOTALS, discountAmount: 0n } as never,
          }),
        );
      case "receipt":
        return renderToBuffer(
          PaymentPdfDocument({
            ...common,
            payment: { id: "p", number: "RCP-0031", currency, amount: 10000000n, allocatedAmount: 10000000n, date: "2026-10-12", method: "bank_transfer", reference: "UTR 5521", notes: null, createdAt: NOW } as never,
            allocations: [{ allocation: { id: "al", amount: 10000000n } as never, invoiceNumber: "INV-0142" }],
          }),
        );
      case "statement":
        return renderToBuffer(
          StatementPdfDocument({
            business,
            branding,
            locale,
            layout,
            statement: {
              contactId: "c",
              contactName: "Lakeview Homes",
              contactEmail: "accounts@lakeview.example",
              contactAddress: "8 Indiranagar 2nd Stage",
              currency,
              from: "2026-09-01",
              to: "2026-09-30",
              mode: "all",
              openingBalance: "0",
              invoiced: "23895000",
              paidAndCredited: "10000000",
              balanceDue: "13895000",
              rows: [
                { date: "2026-09-05", reference: "INV-0142", type: "Invoice", charges: "23895000", payments: "0", balance: "23895000" },
                { date: "2026-09-12", reference: "RCP-0031", type: "Payment", charges: "0", payments: "10000000", balance: "13895000" },
              ],
              aging: { current: "13895000", "1-30": "0", "31-60": "0", "61-90": "0", "90+": "0" },
              hasInvoices: true,
            },
          }),
        );
    }
  }
}
