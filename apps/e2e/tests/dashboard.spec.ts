import type { Page } from "@playwright/test";
import { test, expect, logIn, DEMO_FIELD_USER } from "./fixtures";

/**
 * Dashboard v2 (S-09.11 → S-09.14) was flagged in CHANGELOG as "never
 * pixel-verified — no browser-automation tooling exists in this
 * environment," only checked via typecheck/integration tests/curl. This
 * suite closes that gap for real rendering + the hide/show interaction
 * `dashboard-shell.tsx`'s "Edit layout" mode offers. Structural
 * assertions only (real content present, no pixel-diffing) — see this
 * session's own reasoning on why: font/OS rendering differences make
 * screenshot-diffing brittle across local-macOS vs CI-Linux, and what
 * was actually missing before was "does this even render," not "is it
 * pixel-perfect."
 *
 * Drag-reordering (the other "Edit layout" affordance) is deliberately
 * NOT covered here. `ReorderableItem` (packages/ui/reorderable-list.tsx)
 * uses native HTML5 drag-and-drop, which neither Playwright's
 * `dragTo()`/mouse-simulation APIs nor manually dispatched
 * `DragEvent`s reliably trigger in Chromium — confirmed live across
 * several approaches (synthetic `dispatchEvent`, awaited multi-step
 * dispatch, raw `mouse.down/move/up`): every attempt left
 * `dragover`'s `defaultPrevented` false, meaning `onDragOver`'s
 * `ctx.draggedId` guard never saw a live drag session and no-opped. This
 * was flagged as the likely outcome before starting (see this session's
 * own upfront scoping decision) — the hide/show toggle below is the
 * fully reliable interaction test for this widget-customization flow;
 * revisit drag-reorder coverage only if a Playwright-native solution for
 * HTML5 DnD emerges (e.g. `page.dragAndDrop()` maturing, or switching
 * the component to a pointer-events library like dnd-kit, which several
 * other codebases test successfully).
 */
test.describe("Dashboard v2", () => {
  test("every widget renders with real seeded data", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/dashboard");

    // Pinned KPI summary row (DashboardSummary) — never part of the
    // customizable widget set, always visible for Owner/Staff. Scoped to
    // <main> throughout this test since the sidebar nav also has a
    // "Receivables" link (a different page) sharing the exact text.
    const main = page.getByRole("main");
    // US-DASH-14: the KPI row's cards.
    const kpis = main.getByTestId("kpi-row");
    await expect(kpis.getByText("Cash position")).toBeVisible({ timeout: 15_000 });
    await expect(kpis.getByText("Profit this month")).toBeVisible();
    await expect(kpis.getByText("Receivables", { exact: true })).toBeVisible();
    await expect(kpis.getByText("Overdue", { exact: true })).toBeVisible();

    // Every widget in WIDGET_LABELS, by its own card heading.
    // US-DASH-26 — on the default (Accrual) the money chart reads "Income and expenses".
    await expect(main.getByTestId("money-in-out").getByText("Income and expenses")).toBeVisible();
    await expect(main.getByText("Pipeline by stage")).toBeVisible();
    await expect(main.getByText("Receivables aging")).toBeVisible();
    await expect(main.getByText("Job profitability").first()).toBeVisible();
    // US-DASH-16: one "Today" card replaces the follow-ups, meetings and milestones cards.
    await expect(main.getByTestId("today-card").getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(main.getByText("Invoices due this week")).toBeVisible();
    await expect(main.getByText("Recent activity")).toBeVisible();

    // Real seeded content within a couple of widgets, not just the
    // heading — confirms data actually flowed through, not an empty card.
    await expect(main.getByText(/Hotel lobby renovation/).first()).toBeVisible();
    await expect(main.getByText(/Weekly crew scheduling|Progress review/).first()).toBeVisible();
  });

  test("Field role sees the shorter, non-financial widget set", async ({ page, seededOrg, browser }) => {
    void seededOrg;
    void page; // only used to seed the org above; the Field user needs its own cookie-isolated context
    const fieldContext = await browser.newContext();
    const fieldPage = await fieldContext.newPage();
    await logIn(fieldPage, DEMO_FIELD_USER);
    await fieldPage.goto("/dashboard");

    // Field's own composition (visibleKeysForRole): Today and recent activity, no
    // financial widgets, no pinned KPI summary row at all.
    await expect(fieldPage.getByTestId("today-card")).toBeVisible({ timeout: 15_000 });
    await expect(fieldPage.getByText("Recent activity")).toBeVisible();

    await expect(fieldPage.getByText("Cash position")).toHaveCount(0);
    await expect(fieldPage.getByTestId("money-in-out")).toHaveCount(0);
    await expect(fieldPage.getByText("Receivables aging")).toHaveCount(0);
    await fieldContext.close();
  });

  test("Edit layout: hide a widget, confirm it's gone, then show it again", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/dashboard");
    await expect(page.getByTestId("money-in-out")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Edit layout" }).click();

    // The overlay's small widget-label span ("Money in and out") and its
    // HideToggle button are siblings inside EditableWidgetCard's own
    // corner bar — this is a more precise anchor than the card's whole
    // container div (which also contains the widget's OWN "Money in
    // trend" heading, plus every other widget sharing the same ancestor
    // grid, so a loose `div` text filter matches far too broadly).
    // The layout saves in the background; let this save land before the next one, or the
    // older save can arrive last and hide the widget again.
    const hidden = page.waitForResponse((res) => res.url().includes("/users/me/dashboard-layout") && res.request().method() === "PUT");
    await editModeHideToggle(page, "Money in and out").click();
    await hidden;

    // Hidden state in edit mode is dimmed (opacity-40), not removed —
    // confirm the toggle flipped to "Show widget" rather than asserting
    // on the class directly (an implementation detail).
    await expect(editModeHideToggle(page, "Money in and out")).toHaveAttribute("aria-label", "Show widget");

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByTestId("money-in-out")).toHaveCount(0);

    // Re-show it — persisted layout must survive a reload too, since
    // DashboardShell fetches it fresh via GET /users/me/dashboard-layout.
    await page.getByRole("button", { name: "Edit layout" }).click();
    // The layout saves in the background: wait for it before reloading.
    const saved = page.waitForResponse((res) => res.url().includes("/users/me/dashboard-layout") && res.request().method() === "PUT");
    await editModeHideToggle(page, "Money in and out").click();
    await saved;
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByTestId("money-in-out")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("money-in-out")).toBeVisible({ timeout: 15_000 });
  });
});

/**
 * Locates a widget's own Hide/Show toggle button in edit mode, scoped by
 * the overlay's small label span (`WIDGET_LABELS[key]`, e.g. "Money in
 * trend") — that span and the toggle button are siblings inside
 * `EditableWidgetCard`'s corner bar, both distinct from the widget's own
 * `CardTitle` heading (same text, different element) elsewhere in the
 * card.
 */
function editModeHideToggle(page: Page, widgetLabel: string) {
  return widgetOverlayLabel(page, widgetLabel).locator("xpath=following-sibling::button[1]");
}

/** The overlay's own widget-label span — scoped to a span whose next sibling is the Hide/Show toggle, since `text-[11px]` alone also matches unrelated UI (e.g. the user-menu avatar's initials). */
function widgetOverlayLabel(page: Page, widgetLabel: string) {
  return page.locator("span", { hasText: widgetLabel }).filter({
    has: page.locator("xpath=following-sibling::button[@aria-label='Hide widget' or @aria-label='Show widget']"),
  });
}

