import { describe, expect, it } from "vitest";
import { mergeDashboardLayout, type DashboardLayout } from "./dashboard-widgets.ts";

describe("mergeDashboardLayout", () => {
  it("returns visible keys in registry order when no layout is saved", () => {
    const result = mergeDashboardLayout(null, ["a", "b", "c"]);
    expect(result).toEqual([
      { widgetKey: "a", hidden: false },
      { widgetKey: "b", hidden: false },
      { widgetKey: "c", hidden: false },
    ]);
  });

  it("orders by saved position", () => {
    const saved: DashboardLayout = [
      { widgetKey: "b", position: 0, hidden: false },
      { widgetKey: "a", position: 1, hidden: false },
    ];
    const result = mergeDashboardLayout(saved, ["a", "b"]);
    expect(result.map((r) => r.widgetKey)).toEqual(["b", "a"]);
  });

  it("preserves a saved hidden flag", () => {
    const saved: DashboardLayout = [{ widgetKey: "a", position: 0, hidden: true }];
    const result = mergeDashboardLayout(saved, ["a"]);
    expect(result).toEqual([{ widgetKey: "a", hidden: true }]);
  });

  it("drops a saved entry whose key is no longer visible (removed widget or no longer role-eligible)", () => {
    const saved: DashboardLayout = [
      { widgetKey: "removed-widget", position: 0, hidden: false },
      { widgetKey: "a", position: 1, hidden: false },
    ];
    const result = mergeDashboardLayout(saved, ["a"]);
    expect(result).toEqual([{ widgetKey: "a", hidden: false }]);
  });

  it("appends a newly-visible widget not present in the saved layout, at the end, not hidden", () => {
    const saved: DashboardLayout = [{ widgetKey: "a", position: 0, hidden: true }];
    const result = mergeDashboardLayout(saved, ["a", "new-widget"]);
    expect(result).toEqual([
      { widgetKey: "a", hidden: true },
      { widgetKey: "new-widget", hidden: false },
    ]);
  });

  it("never fails on a saved layout that is entirely stale", () => {
    const saved: DashboardLayout = [{ widgetKey: "gone", position: 0, hidden: false }];
    const result = mergeDashboardLayout(saved, ["a", "b"]);
    expect(result.map((r) => r.widgetKey)).toEqual(["a", "b"]);
  });
});
