import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ONBOARDING_STAGES, ONBOARDING_STEPS, TOTAL_MINUTES, minutesLeft, nextStep, previousStep, stepPosition } from "../app/onboarding/onboarding-stages";
import { OnboardingPreview, presetTaxLine, type PreviewData } from "../app/onboarding/onboarding-preview";

const base: PreviewData = {
  business: {},
  currency: { code: "USD", locale: "en-US" },
  tax: null,
  invoiceNumber: "INV-0001",
  accounts: { asset: 8, liability: 5, equity: 4, income: 4, expense: 10 },
  owner: "Priya Raman",
  invites: [],
  taxCountryLabel: null,
};

describe("US-ONB-22 · four stages", () => {
  it("keeps the eight steps in order, grouped into Business, Money, Documents and Books & team", () => {
    expect(ONBOARDING_STAGES.map((s) => s.label)).toEqual(["Business", "Money", "Documents", "Books & team"]);
    expect(ONBOARDING_STEPS.map((s) => s.key)).toEqual(["profile", "template", "currency", "fiscal_year", "tax", "numbering", "accounts", "team"]);
    expect(ONBOARDING_STEPS.every((s) => s.tip.where.length > 0)).toBe(true);
  });

  it("counts minutes down and knows where each step sits", () => {
    expect(TOTAL_MINUTES).toBe(6);
    expect(minutesLeft("currency")).toBe(5);
    expect(minutesLeft("team")).toBe(1);
    expect(stepPosition("tax")).toMatchObject({ stageNumber: 2, stepNumber: 3, stage: { label: "Money" } });
    expect(previousStep("profile")).toBeNull();
    expect(previousStep("template")).toBe("profile");
    expect(nextStep("team")).toBeNull();
  });

  it("shows a preset country's usual rate on the tax line", () => {
    expect(presetTaxLine("IN")).toEqual({ label: "CGST 9% + SGST 9%", percentage: 18 });
    expect(presetTaxLine("GB")).toEqual({ label: "VAT 20%", percentage: 20 });
    expect(presetTaxLine("AU")).toEqual({ label: "GST 10%", percentage: 10 });
    expect(presetTaxLine("other")).toBeNull();
  });
});

describe("US-ONB-22 · live preview", () => {
  it("shows 'Your business' until a name is typed, then the name, currency, tax and number", () => {
    const { rerender } = render(<OnboardingPreview step="profile" data={base} />);
    const preview = screen.getByTestId("onboarding-preview");
    expect(preview.getAttribute("aria-hidden")).toBe("true");
    expect(preview.textContent).toContain("Your business");
    expect(preview.textContent).toContain("Tax — set in the Tax step");

    rerender(
      <OnboardingPreview
        step="numbering"
        data={{ ...base, business: { name: "Harbour Lights Studio" }, currency: { code: "INR", locale: "en-IN" }, tax: { label: "CGST 9% + SGST 9%", percentage: 18 }, invoiceNumber: "INV-1042" }}
      />,
    );
    const text = screen.getByTestId("onboarding-preview").textContent ?? "";
    expect(text).toContain("Harbour Lights Studio");
    expect(text).toContain("₹1,25,000.00");
    expect(text).toContain("₹22,500.00");
    expect(text).toContain("₹1,47,500.00");
    expect(text).toContain("Your first invoice will be INV-1042.");
  });

  it("turns to the books and the team in the last stage", () => {
    render(<OnboardingPreview step="team" data={{ ...base, invites: [{ email: "marcus@example.com", role: "field" }] }} />);
    const text = screen.getByTestId("onboarding-preview").textContent ?? "";
    expect(text).toContain("Your books");
    expect(text).toContain("Expenses10");
    expect(text).toContain("Priya RamanOwner · you");
    expect(text).toContain("marcus@example.comFieldInvited");
  });
});
