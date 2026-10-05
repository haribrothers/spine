import { describe, expect, it } from "vitest";
import { defaultHiddenWidgets, mergeDashboardLayout } from "./schemas/dashboard-widgets.ts";

describe("US-DASH-20 · retention and jobs in progress start shown only for Construction", () => {
  const keys = ["money-in-out", "pipeline-by-stage", "retention-held", "jobs-in-progress", "activity-feed"];

  it("with no saved layout, Construction shows both cards below Money in and out", () => {
    expect(defaultHiddenWidgets("construction")).toEqual([]);
    expect(mergeDashboardLayout(null, keys, defaultHiddenWidgets("construction"))).toEqual(keys.map((widgetKey) => ({ widgetKey, hidden: false })));
  });

  it("any other template starts them hidden, ready to show from Edit layout", () => {
    for (const template of ["general_services", "generic", null]) {
      const merged = mergeDashboardLayout(null, keys, defaultHiddenWidgets(template));
      expect(merged.filter((e) => e.hidden).map((e) => e.widgetKey)).toEqual(["retention-held", "jobs-in-progress"]);
    }
  });

  it("a saved choice wins over the template default", () => {
    const saved = [
      { widgetKey: "retention-held", position: 0, hidden: false },
      { widgetKey: "money-in-out", position: 1, hidden: false },
    ];
    const merged = mergeDashboardLayout(saved, keys, defaultHiddenWidgets("generic"));
    expect(merged.slice(0, 2)).toEqual([
      { widgetKey: "retention-held", hidden: false },
      { widgetKey: "money-in-out", hidden: false },
    ]);
    expect(merged.find((e) => e.widgetKey === "jobs-in-progress")!.hidden).toBe(true);
  });
});
