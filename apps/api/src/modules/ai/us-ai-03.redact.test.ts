import { describe, expect, it } from "vitest";
import { redact } from "./redact";

/** US-AI-03 (D-165) — what's never sent to an AI provider. */
describe("US-AI-03 · redaction", () => {
  it.each([
    ["a bank account number", "NEFT DR 50100234567812 RIDGELINE", "NEFT DR [account number] RIDGELINE"],
    ["an IFSC code", "Bank: HDFC0001234, Koramangala", "Bank: [IFSC], Koramangala"],
    ["a routing number", "ACH from 021000021 Chase", "ACH from [account number] Chase"],
    ["an IBAN", "Pay to GB29 NWBK 6016 1331 9268 19 please", "Pay to [IBAN] please"],
    ["a card number", "Card 4111 1111 1111 1111 exp 04/29", "Card [card number] exp 04/29"],
    ["a GSTIN", "GSTIN 29AABCH1234K1Z2 · Hosur Road", "GSTIN [GSTIN] · Hosur Road"],
    ["a PAN", "PAN ABCPE1234F on file", "PAN [PAN] on file"],
    ["a US EIN", "EIN 12-3456789", "EIN [tax ID]"],
    ["a US SSN", "SSN 123-45-6789", "SSN [tax ID]"],
    ["a UK VAT number", "VAT GB123456789", "VAT [tax ID]"],
    ["a UPI ID", "UPI CR rao.ananya@okaxis MAPLE", "UPI CR [UPI ID] MAPLE"],
    ["a password", "the password: hunter2 for the portal", "the password: [password] for the portal"],
    ["an API key", "use sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123", "use [key]"],
    ["a bearer token", "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abcdefgh", "Authorization: [key]"],
  ])("removes %s", (_, input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it.each([
    ["amounts", "Total ₹4,850.00 incl. GST 18% (₹739.83)"],
    ["dates and times", "13/10/2026 07:52 and 2026-10-13"],
    ["document numbers", "INV-0031 for QUO-0058, ABM-20611 and PAY-0040"],
    ["email addresses", "Send it to accounts@halcyontech.in"],
    ["a short reference", "UTR 5512 0943 · cheque 004417"],
    ["ordinary words", "Diesel for the JCB — Wing C fit-out"],
  ])("keeps %s", (_, input) => {
    expect(redact(input)).toBe(input);
  });
});
