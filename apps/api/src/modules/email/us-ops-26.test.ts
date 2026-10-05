import { describe, expect, it } from "vitest";
import { EMAIL_COLORS, renderEmail } from "./email-layout";
import { invoiceEmail, notificationEmail } from "./email-templates";

/**
 * US-OPS-26 (D-100) — customer emails and PDFs are always light, whatever
 * theme the person sending them uses: the layout declares a light colour
 * scheme, inlines only the light token values and has no dark-mode CSS.
 */
describe("US-OPS-26 · emails stay light", () => {
  const brand = { name: "Riverstone Builders", color: "#2954E5", footer: "Riverstone Builders · 12 Quarry Lane" };
  const emails = [
    invoiceEmail({ businessName: brand.name, contactName: "Alan Brooks", number: "INV-0007", currency: "USD", total: 220000n, retention: 0n, balanceDue: 220000n, dueDate: new Date("2026-10-17T00:00:00Z") }),
    notificationEmail({ businessName: brand.name, subject: "Payment received", text: "Alan paid $2,500.00.", link: "/payments?id=p1" }),
  ];

  for (const template of emails) {
    it(`"${template.subject}" is light only`, () => {
      const { html } = renderEmail(brand, template.content);
      expect(html).toContain('<meta name="color-scheme" content="light">');
      expect(html).not.toMatch(/prefers-color-scheme|data-theme|color-scheme:\s*dark/);
      expect(html).toContain(`background:${EMAIL_COLORS.canvas}`);
      expect(html).toContain(`background:${EMAIL_COLORS.surface}`);
      expect(EMAIL_COLORS.surface).toBe("#FFFFFF");
    });
  }
});
