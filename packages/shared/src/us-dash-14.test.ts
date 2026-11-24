import { describe, expect, it } from "vitest";
import { kpiChange } from "./schemas/kpis.ts";

/** US-DASH-14 (D-089) — the comparison line under each key figure. */
describe("US-DASH-14 · KPI comparison", () => {
  it("is green when the change is good for the business, red when it isn't, always with the arrow and sign", () => {
    expect(kpiChange({ key: "cash", format: "money", value: "1202475", previous: "1111275" })).toEqual({ text: "▲ +8.2% vs last month", tone: "good" });
    expect(kpiChange({ key: "receivables", format: "money", value: "3516550", previous: "3128700" })).toEqual({ text: "▲ +12.4% vs last month", tone: "bad" });
    expect(kpiChange({ key: "overdue", format: "money", value: "454250", previous: "582400" })).toEqual({ text: "▼ −22.0% vs last month", tone: "good" });
    expect(kpiChange({ key: "profit", format: "money", value: "-5000", previous: "10000" })).toEqual({ text: "▼ −150.0% vs last month", tone: "bad" });
  });

  it("counts compare as a difference", () => {
    expect(kpiChange({ key: "quotes_won", format: "count", value: "4", previous: "2" })).toEqual({ text: "▲ +2 vs last month", tone: "good" });
  });

  it("reads 'No data last month' without a figure (or a zero) to compare with", () => {
    expect(kpiChange({ key: "cash", format: "money", value: "100", previous: null })).toEqual({ text: "No data last month", tone: "none" });
    expect(kpiChange({ key: "cash", format: "money", value: "100", previous: "0" })).toEqual({ text: "No data last month", tone: "none" });
  });
});
