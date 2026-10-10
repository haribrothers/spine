import { test, expect } from "@playwright/test";
import { api, card, column, moveVia, pipelineOrg, type Stage } from "./pipeline-helpers";

test.describe("US-CRM-24", () => {
  test("open stages share the width with Won and Lost slim at the right; every column runs full height; the summary strip filters overdue", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await pipelineOrg(page);
    // Six open stages (three more than the default) still fit at 1280 px.
    const input = org.stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind }));
    const extra = ["Site visit", "Quote sent", "Negotiation"].map((name) => ({ name, kind: "open" as const }));
    await api(page, "PUT", "/org/lead-stages", { stages: [...input.filter((s) => s.kind === "open"), ...extra, ...input.filter((s) => s.kind !== "open")] });

    const villa = await org.addLead("Villa extension", { value: "1260000" });
    await org.addLead("Office block", { contactId: org.contacts.halcyon, stage: "Qualified", value: "14400000" });
    await api(page, "POST", "/activities", { leadId: villa.id, contactId: org.contacts.ananya, type: "call", dueAt: new Date(Date.now() - 2 * 86_400_000).toISOString() });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/leads");
    await expect(page.getByText("Your open leads by stage, and what you've won and lost lately.")).toBeVisible();
    const board = page.getByTestId("pipeline-board");
    await expect(board).toBeVisible();
    const stageNames = () => page.locator("[data-stage]").evaluateAll((els) => els.map((el) => el.getAttribute("data-stage")));
    await expect.poll(stageNames).toEqual(["New", "Qualified", "Proposal", "Site visit", "Quote sent", "Negotiation", "Won", "Lost"]);
    // No sideways scroll, and no "more" shadow.
    const scroller = board.locator("[data-more-start], [data-more-end]");
    await expect(scroller).toHaveCount(0);
    // Won and Lost are slim (56 px), at the right, with their count and total.
    await expect(column(page, "Won").getByRole("button", { name: /^Show Won: 0 leads in the last 30 days/ })).toBeVisible();
    expect((await column(page, "Lost").boundingBox())!.width).toBeLessThanOrEqual(57);

    // Every column runs to the same bottom edge, whatever its cards.
    const bottoms = await page.locator("[data-stage]").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().bottom)));
    expect(new Set(bottoms).size).toBe(1);
    const viewportBottom = 800;
    expect(viewportBottom - bottoms[0]!).toBeLessThan(60);

    // Each open column: dot, name, count and total; an empty one says so.
    await expect(column(page, "New").getByText("₹12,600.00").first()).toBeVisible();
    await expect(column(page, "Proposal").getByText("No leads in this stage")).toBeVisible();

    // The summary: open pipeline, won this month, win rate, overdue follow-ups.
    const summary = page.getByTestId("pipeline-summary");
    await expect(summary.getByTestId("summary-open")).toContainText(/₹1,?56,600\.00/);
    await expect(summary.getByTestId("summary-open")).toContainText("2 leads");
    await expect(summary.getByTestId("summary-win-rate")).toContainText("None closed in the last 90 days");
    const overdue = summary.getByRole("button", { name: /^Show leads with overdue follow-ups, 1/ });
    await overdue.click();
    await expect(page).toHaveURL(/overdue=1/);
    await expect(card(page, "Villa extension")).toBeVisible();
    await expect(card(page, "Office block")).toHaveCount(0);
    await expect(summary.getByRole("button", { name: /^Show all leads/ })).toHaveAttribute("aria-pressed", "true");
    await summary.getByRole("button", { name: /^Show all leads/ }).click();
    await expect(card(page, "Office block")).toBeVisible();

    // A narrow window scrolls sideways and says there's more.
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(board.locator("[data-more-end]")).toHaveCount(1);
  });

  test("a slim column opens to its last 30 days, newest first, and closes again; older ones are a stage filter away", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await pipelineOrg(page);
    await org.addLead("Warehouse extension", { stage: "Proposal", value: "6600000" });
    await org.addLead("Office block", { stage: "Proposal", value: "14400000" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/leads");
    await moveVia(page, "Warehouse extension", "Won");
    await page.getByRole("button", { name: "Not now" }).click();
    await moveVia(page, "Office block", "Won");
    await page.getByRole("button", { name: "Not now" }).click();

    const slim = column(page, "Won").getByRole("button", { name: /^Show Won: 2 leads in the last 30 days, ₹2,?10,000\.00/ });
    await slim.click();
    const won = column(page, "Won");
    await expect(won.getByRole("heading", { name: "Won · last 30 days" })).toBeVisible();
    await expect(won.locator("[data-lead]")).toHaveText([/Office block/, /Warehouse extension/]);
    await expect(won.getByText("Older won leads: choose Won in the stage filter.")).toBeVisible();
    await won.getByRole("button", { name: "Hide Won" }).click();
    await expect(column(page, "Won").getByRole("button", { name: /^Show Won/ })).toBeVisible();

    // The stage filter shows every won lead, as a full column.
    const wonStage = org.stages.find((s: Stage) => s.kind === "won")!;
    await page.goto(`/leads?stage=${wonStage.id}`);
    await expect.poll(() => page.locator("[data-stage]").evaluateAll((els) => els.map((el) => el.getAttribute("data-stage")))).toEqual(["Won"]);
    await expect(column(page, "Won").locator("[data-lead]")).toHaveCount(2);
  });
});
