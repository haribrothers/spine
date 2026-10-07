import { describe, expect, it } from "vitest";
import { renderEmailBody, splitGreeting } from "./email-html";
import { invoiceEmail } from "./email-templates";

const styles = { paragraph: "P", list: "L", item: "I", link: "A" };

describe("D-189 · rich text email messages", () => {
  it("keeps the editor's formatting with inline styles: paragraphs, bold, italics, lists and links", () => {
    const { html, textBlocks } = renderEmailBody('<p>Hello <strong>there</strong> and <em>welcome</em></p><ul><li>One</li><li>Two</li></ul><p>See <a href="https://example.com/pay">how to pay</a></p>', styles);
    expect(html).toBe('<p style="P">Hello <strong>there</strong> and <em>welcome</em></p>\n<ul style="L"><li style="I">One</li><li style="I">Two</li></ul>\n<p style="P">See <a href="https://example.com/pay" style="A">how to pay</a></p>');
    expect(textBlocks).toEqual(["Hello there and welcome", "• One\n• Two", "See how to pay (https://example.com/pay)"]);
  });

  it("drops anything the editor can't make: scripts, styles, unsafe links, other tags keep only their text", () => {
    const { html } = renderEmailBody('<p onclick="x()">Hi<script>alert(1)</script></p><p><a href="javascript:alert(1)">click</a> <img src="x" onerror="y()"><span style="color:red">red</span></p><h1>Big</h1>', styles);
    expect(html).not.toMatch(/script|onclick|onerror|javascript|<img|<span|<h1|style="color/i);
    expect(html).toContain("click red");
    expect(html).toContain("Big");
  });

  it("makes web addresses in text clickable", () => {
    expect(renderEmailBody("<p>Pay at https://example.com/pay.</p>", styles).html).toBe('<p style="P">Pay at <a href="https://example.com/pay" style="A">https://example.com/pay</a>.</p>');
  });

  it("a short first paragraph ending in a comma is the greeting", () => {
    expect(splitGreeting("<p>Hi Alan,</p><p>Thanks.</p>")).toEqual({ greeting: "Hi Alan,", rest: "<p>Thanks.</p>" });
    expect(splitGreeting("<p>Hi <strong>Alan</strong>,</p><p>Thanks.</p>").greeting).toBeUndefined();
    expect(splitGreeting("<p>Just one paragraph,</p>").greeting).toBeUndefined();
  });

  it("puts values in escaped, so a customer's name can't add HTML", () => {
    const email = invoiceEmail({
      businessName: "Riverstone",
      contactName: '<img src=x onerror="alert(1)">',
      number: "INV-1",
      currency: "USD",
      total: 100n,
      retention: 0n,
      balanceDue: 100n,
      dueDate: null,
      text: { subject: "Invoice", body: "<p>Dear {customer_name},</p><p>Thanks.</p>" },
    });
    expect(email.content.greeting).toBe('Dear <img,');
    expect(email.content.bodyHtml).toBe("<p>Thanks.</p>");
    const plain = invoiceEmail({ businessName: "R", contactName: "Alan", number: "INV-1", currency: "USD", total: 100n, retention: 0n, balanceDue: 100n, dueDate: null, text: { subject: "S", body: "Line one\nline two\n\nNext" } });
    // Plain text from before D-189 still reads as paragraphs.
    expect(plain.content.bodyHtml).toBe("<p>Line one<br>line two</p><p>Next</p>");
  });
});
