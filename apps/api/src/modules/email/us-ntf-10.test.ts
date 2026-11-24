import { describe, expect, it } from "vitest";
import { EMAIL_COLORS, EMAIL_LOGO_CID, emailDate, emailMoney, firstName, renderEmail, type EmailBrand } from "./email-layout";

const brand: EmailBrand = {
  name: "Riverstone Builders",
  color: "#0D6E6E",
  footer: "Riverstone Builders · 14 Harbour Road, Marina District",
  logo: { content: Buffer.from("png"), contentType: "image/png" },
};

const quoteEmail = () =>
  renderEmail(brand, {
    heading: "Your quote is ready",
    greeting: "Hi Alan,",
    paragraphs: ["Here's our quote. You can read it, accept it or decline it online — no account needed."],
    facts: [
      { label: "Quote", value: "QUO-0004" },
      { label: "Total", value: "510.00 USD" },
      { label: "Valid until", value: "17 Oct 2026" },
    ],
    button: { label: "View quote", url: "https://spine.example/quote/abc" },
    note: "The quote is also attached as a PDF. Questions? Reply to this email.",
  });

describe("US-NTF-10 · one branded layout for every email", () => {
  it("has a 6px bar in the document colour, the logo, the business name, a heading and the footer", () => {
    const { html } = quoteEmail();
    expect(html).toContain("border-top:6px solid #0D6E6E");
    expect(html).toContain(`src="cid:${EMAIL_LOGO_CID}"`);
    expect(html).toContain(">Riverstone Builders</td>");
    expect(html).toContain("<h1");
    expect(html).toContain("Your quote is ready");
    expect(html).toContain("Riverstone Builders · 14 Harbour Road, Marina District");
  });

  it("shows the key facts and exactly one button", () => {
    const { html } = quoteEmail();
    for (const text of ["Quote", "QUO-0004", "Total", "510.00 USD", "Valid until", "17 Oct 2026", "Hi Alan,"]) expect(html).toContain(text);
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="https://spine.example/quote/abc"');
    expect(html).toContain(">View quote</a>");
  });

  it("still makes sense with images blocked: the name is text and the logo's alt text is the name", () => {
    const { html } = quoteEmail();
    expect(html).toContain('alt="Riverstone Builders"');
    const withoutImages = html.replace(/<img[^>]*>/g, "");
    expect(withoutImages).toContain("Riverstone Builders");
    expect(withoutImages).toContain("View quote");
  });

  it("includes a plain-text alternative with the same content and the link", () => {
    const { text } = quoteEmail();
    expect(text).toContain("Your quote is ready");
    expect(text).toContain("Total: 510.00 USD");
    expect(text).toContain("View quote: https://spine.example/quote/abc");
    expect(text).not.toContain("<");
  });

  it("attaches the logo inline, and leaves it out when there is none", () => {
    expect(quoteEmail().attachments).toEqual([expect.objectContaining({ cid: EMAIL_LOGO_CID, contentType: "image/png" })]);
    const plain = renderEmail({ ...brand, logo: undefined }, { heading: "Hi", paragraphs: [] });
    expect(plain.attachments).toEqual([]);
    expect(plain.html).not.toContain("<img");
  });

  it("falls back to the default colour for a bad value, and escapes what people typed", () => {
    const { html } = renderEmail({ ...brand, color: "red;background:url(x)", name: "A&B <Ltd>" }, { heading: "<b>x</b>", paragraphs: ["1 < 2"] });
    expect(html).toContain(`border-top:6px solid ${EMAIL_COLORS.primary}`);
    expect(html).toContain("A&amp;B &lt;Ltd&gt;");
    expect(html).not.toContain("<b>x</b>");
  });

  it("formats money, dates and first names the way the emails show them", () => {
    expect(emailMoney(51000n, "USD")).toBe("$510.00");
    expect(emailMoney(123456789n, "USD")).toBe("$1,234,567.89");
    expect(emailMoney(-433500n, "USD")).toBe("−$4,335.00");
    expect(emailMoney(12024750n, "INR", "en-IN")).toBe("₹1,20,247.50");
    expect(emailDate(new Date("2026-10-17T00:00:00Z"))).toBe("17 Oct 2026");
    expect(firstName("Alan Brooks")).toBe("Alan");
    expect(firstName(null)).toBe("there");
  });
});
