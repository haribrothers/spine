import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

async function post(page: Page, route: string, data: unknown) {
  const res = await page.request.post(`${API_URL}${route}`, { data, headers: { "Idempotency-Key": randomUUID() } });
  expect(res.ok(), `${route}: ${res.status()}`).toBe(true);
  return res.json();
}

async function openStages(page: Page) {
  await page.getByRole("button", { name: /Stage Owner/ }).last().click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("settings-sections").getByRole("button", { name: "Pipeline stages" }).click();
  return dialog.getByTestId("settings-pane");
}

test.describe("US-CRM-20", () => {
  test("an empty stage is deleted straight away; a stage with leads asks where they go, and they move there on save", async ({ page }) => {
    // A fresh organisation, so the default stages are untouched by other specs.
    await signUpNewOrg(page, { name: "Stage Owner", email: `us-crm-20-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const contact = (await post(page, "/contacts", { name: "Maple Ridge Developments", type: "customer" })) as { id: string };
    const stages = (await (await page.request.get(`${API_URL}/org/lead-stages`)).json()) as { id: string; name: string }[];
    const proposal = stages.find((s) => s.name === "Proposal")!;
    for (const title of ["Phase 2 townhomes", "Boundary survey", "Curtain wall"]) {
      await post(page, "/leads", { contactId: contact.id, valueCurrency: "USD", title, stageId: proposal.id });
    }

    const pane = await openStages(page);
    await pane.getByRole("button", { name: "+ Add stage" }).click();
    await pane.getByRole("button", { name: "Delete New stage" }).click();
    await expect(pane.locator('input[value="New stage"]')).toHaveCount(0);

    await pane.getByRole("button", { name: "Delete Proposal" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByText("Move 3 leads to:")).toBeVisible();
    await expect(confirm.getByRole("button", { name: "Delete stage" })).toBeDisabled();
    await confirm.getByRole("combobox").click();
    await page.getByRole("option", { name: "Qualified" }).click();
    await confirm.getByRole("button", { name: "Delete stage" }).click();
    await expect(pane.locator('input[value="Proposal"]')).toHaveCount(0);
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();

    await page.goto("/leads");
    const stageNames = () => page.locator("[data-stage]").evaluateAll((els) => els.map((el) => el.getAttribute("data-stage")));
    await expect.poll(stageNames).toEqual(["New", "Qualified", "Won", "Lost"]);
    const count = (title: string) => page.locator("h3", { hasText: title }).locator("xpath=following-sibling::span[1]");
    await expect(count("Qualified")).toHaveText("3");
    await expect(page.getByText("Curtain wall")).toBeVisible();
  });
});
