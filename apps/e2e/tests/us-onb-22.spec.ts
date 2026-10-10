import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";

async function signUpToOnboarding(page: Page, name: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(`e2e-onb-22-${randomUUID()}@example.com`);
  await page.getByLabel(/^Password/).fill("e2e-test-password-1");
  await page.getByLabel(/^Confirm password/).fill("e2e-test-password-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");
}

const continueButton = (page: Page) => page.getByRole("button", { name: "Continue", exact: true });

test.describe("US-ONB-22", () => {
  test("four stages with a rail, tips and a live preview of the first invoice that updates before saving", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signUpToOnboarding(page, "Priya Raman");

    // The start screen: four stages, the same three choices, Spine drawn small.
    await expect(page.getByRole("heading", { level: 1, name: "Welcome to Spine, Priya" })).toBeVisible();
    await expect(page.getByText("Four short stages, about 6 minutes.", { exact: false })).toBeVisible();
    for (const line of ["Your name, logo and kind of work", "Currency, financial year and tax", "How your quotes and invoices are numbered", "Your accounts and the people you work with"]) {
      await expect(page.getByText(line)).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Just show me around (use defaults)" })).toBeVisible();
    await expect(page.getByTestId("onboarding-start-illustration")).toHaveAttribute("aria-hidden", "true");
    await page.getByRole("button", { name: "Set up my business" }).click();

    // The rail and where we are.
    const rail = page.getByRole("navigation", { name: "Setup steps" });
    await expect(rail.locator('[aria-current="step"]')).toHaveText("Details");
    await expect(rail.getByText("About 6 min left")).toBeVisible();
    await expect(page.getByTestId("onboarding-position")).toHaveText("Stage 1 of 4 · Business · Step 1 of 2");
    await expect(page.getByTestId("onboarding-tip")).toContainText("Change it later in Settings › Business profile.");
    await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);

    // The preview shows the name as it's typed, before anything is saved.
    const preview = page.getByTestId("onboarding-preview");
    await expect(preview).toContainText("Your business");
    await page.getByLabel(/^Business name/).fill("Harbour Lights Studio");
    await expect(preview).toContainText("Harbour Lights Studio");
    await continueButton(page).click();

    // Back returns to the saved step.
    await expect(page.getByTestId("onboarding-position")).toHaveText("Stage 1 of 4 · Business · Step 2 of 2");
    await expect(rail.getByText("Details (done)")).toBeAttached();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByLabel(/^Business name/)).toHaveValue("Harbour Lights Studio");
    await continueButton(page).click();
    await continueButton(page).click();

    // Money: rupees and Indian grouping appear while picking.
    await expect(page.getByTestId("onboarding-position")).toHaveText("Stage 2 of 4 · Money · Step 1 of 3");
    await expect(rail.getByText("About 5 min left")).toBeVisible();
    await page.getByLabel("Currency").fill("INR");
    await page.getByLabel("Locale").fill("en-IN");
    await expect(preview).toContainText("₹1,25,000.00");
    await continueButton(page).click();
    await continueButton(page).click();

    // Tax: India is guessed from the currency, and its usual rate shows on the line.
    await expect(page.getByRole("heading", { name: "Tax", exact: true })).toBeVisible();
    await expect(preview).toContainText("CGST 9% + SGST 9%");
    await expect(preview).toContainText("₹22,500.00");
    await continueButton(page).click();
    await page.getByRole("button", { name: "Not registered yet — skip this step" }).click();

    // Documents: the first invoice number follows the starting number.
    await expect(page.getByTestId("onboarding-position")).toHaveText("Stage 3 of 4 · Documents · Step 1 of 1");
    await page.getByRole("row", { name: /^Invoice/ }).getByRole("spinbutton").nth(1).fill("1042");
    await expect(preview).toContainText("INV-1042");
    await continueButton(page).click();

    // Books & team: the preview turns to the books and the team.
    await expect(page.getByTestId("onboarding-position")).toHaveText("Stage 4 of 4 · Books & team · Step 1 of 2");
    await expect(preview).toContainText("Your books");
    await expect(preview).toContainText("Priya Raman");
    await expect(page.getByTestId("onboarding-tip")).toContainText("Change it later in Settings › Chart of accounts.");
  });

  test("below 1024 px the rail is a bar at the top and the preview is left out", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpToOnboarding(page, "Narrow Owner");
    await page.getByRole("button", { name: "Set up my business" }).click();
    await expect(page.getByText("Stage 1 of 4 · Business", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("· About 6 min left")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Setup steps" })).toBeHidden();
    await expect(page.getByTestId("onboarding-preview")).toBeHidden();
  });

  test("a short window scrolls with the wheel, and a long business name keeps the invoice number inside the preview", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 640 });
    await signUpToOnboarding(page, "Scroll Owner");
    await page.getByRole("button", { name: "Set up my business" }).click();

    // A person can scroll to Continue (the body itself never scrolls; the wizard does).
    const continueButton = page.getByRole("button", { name: "Continue", exact: true });
    await expect(continueButton).not.toBeInViewport();
    await page.mouse.move(800, 400);
    await page.mouse.wheel(0, 1200);
    await expect(continueButton).toBeInViewport();

    await page.getByLabel(/^Business name/).fill("H2Z Facades and Interiors Factory Private Limited");
    const preview = page.getByTestId("onboarding-preview");
    const card = await preview.locator("> div").first().boundingBox();
    const number = await preview.getByText("INV-0001", { exact: true }).boundingBox();
    expect(card && number).toBeTruthy();
    expect(number!.x + number!.width).toBeLessThanOrEqual(card!.x + card!.width);
  });
});

