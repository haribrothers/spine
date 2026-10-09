import type { PresentedQuote } from "../lib/data/quotes";

/** QUO-0004 as presented (`MobQuotePresent`): 6 × $85.00 with Sales Tax 15% and a 2.5% surcharge. */
export const PRESENTED: PresentedQuote = {
  id: "q-4",
  number: "QUO-0004",
  status: "sent",
  contactName: "Harborview Construction Co.",
  currency: "USD",
  validUntil: "2026-10-17",
  subtotalAmount: "51000",
  discountAmount: "0",
  totalAmount: "60116",
  notes: "<p>Additional scope requested on site — see attached line items.</p>",
  business: { name: "Riverstone Builders", address: "220 Timberline Ave, Suite 4, Burlington, VT 05401" },
  taxLines: [
    { label: "Sales Tax (15%)", amount: "7650" },
    { label: "State Surcharge (2.5%)", amount: "1466" },
  ],
  lines: [{ id: "l-1", type: "item", name: "Additional electrical outlets (site-requested)", description: null, quantity: 6, unitPriceAmount: "8500", lineSubtotalAmount: "51000" }],
  respondedAt: null,
  acceptedSignerName: null,
  acceptedByName: null,
};

export const ACCEPTED: PresentedQuote = { ...PRESENTED, status: "accepted", respondedAt: "2026-10-08T14:42:00.000Z", acceptedSignerName: "Alan Reyes", acceptedByName: "Marcus Webb" };
