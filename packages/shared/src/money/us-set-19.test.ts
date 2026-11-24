import { describe, expect, it } from "vitest";
import { amountInWords } from "./amount-in-words.ts";

describe("US-SET-19 · the amount in words", () => {
  it("reads rupees with lakh and crore, paise, and 'Only'", () => {
    expect(amountInWords(1250050n, "INR")).toBe("Rupees Twelve Thousand Five Hundred and Fifty Paise Only");
    expect(amountInWords(24190000n, "INR")).toBe("Rupees Two Lakh Forty-One Thousand Nine Hundred Only");
    expect(amountInWords(1234567800n, "INR")).toBe("Rupees One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight Only");
    expect(amountInWords(100n, "INR")).toBe("Rupees One Only");
    expect(amountInWords(5n, "INR")).toBe("Rupees Zero and Five Paise Only");
    expect(amountInWords(-50000n, "INR")).toBe("Minus Rupees Five Hundred Only");
  });

  it("reads other currencies with thousand, million and billion", () => {
    expect(amountInWords(1250050n, "USD")).toBe("Twelve thousand five hundred dollars and fifty cents");
    expect(amountInWords(100n, "USD")).toBe("One dollar");
    expect(amountInWords(101n, "EUR")).toBe("One euro and one cent");
    expect(amountInWords(123456789000n, "GBP")).toBe("One billion two hundred and thirty-four million five hundred and sixty-seven thousand eight hundred and ninety pounds");
    expect(amountInWords(100500n, "AUD")).toBe("One thousand and five dollars");
    expect(amountInWords(250000n, "AED")).toBe("Two thousand five hundred dirhams");
    expect(amountInWords(-1000n, "USD")).toBe("Minus ten dollars");
  });

  it("ends with the code for a currency it has no names for", () => {
    expect(amountInWords(1000n, "CHF")).toBe("Ten CHF");
  });
});
