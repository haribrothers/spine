import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

test.describe("US-MCP-02", () => {
  test("an Owner turns connected agents on after confirming, gets the address, turns drafts off, and Modules links back", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-mcp-02-${randomUUID()}@example.com`, password: "TestPassword123!" });

    // Settings search finds it.
    await page.goto("/dashboard?settings=business");
    await page.getByPlaceholder("Search settings").fill("ChatGPT");
    await expect(page.getByRole("button", { name: /Connected agents/ })).toBeVisible();

    await page.goto("/dashboard?settings=agents");
    const pane = page.getByTestId("agents-pane");
    const theSwitch = pane.getByRole("switch", { name: "Connected agents" });
    await expect(theSwitch).toHaveAttribute("aria-checked", "false");
    await expect(pane.getByTestId("connector-address")).toHaveCount(0);

    await theSwitch.click();
    const confirm = page.getByRole("alertdialog", { name: "Turn on connected agents?" });
    await expect(confirm).toContainText("sends it to that agent's AI provider");
    await confirm.getByRole("button", { name: "Turn on connected agents" }).click();
    await expect(page.getByTestId("toast").getByText("Connected agents are on").first()).toBeVisible();
    await expect(theSwitch).toHaveAttribute("aria-checked", "true");
    await expect(pane.getByTestId("connector-address")).toContainText(/\/mcp$/);

    const drafts = pane.getByRole("switch", { name: "Agents can create drafts" });
    await expect(drafts).toHaveAttribute("aria-checked", "true");
    await drafts.click();
    await expect(page.getByTestId("toast").getByText("Agents can only read").first()).toBeVisible();
    await expect(drafts).toHaveAttribute("aria-checked", "false");

    // Modules lists it after AI assistant, with its state, linking to the pane.
    await page.goto("/dashboard?settings=modules");
    await expect(page.getByTestId("module-agents")).toContainText("On");
    await page.getByTestId("module-agents").getByRole("button", { name: "Set up in Connected agents" }).click();
    await expect(page).toHaveURL(/settings=agents/);

    // Off asks too.
    await page.getByTestId("agents-pane").getByRole("switch", { name: "Connected agents" }).click();
    await page.getByRole("alertdialog", { name: "Turn off connected agents?" }).getByRole("button", { name: "Turn off connected agents" }).click();
    await expect(page.getByTestId("toast").getByText("Connected agents are off").first()).toBeVisible();
  });
});
