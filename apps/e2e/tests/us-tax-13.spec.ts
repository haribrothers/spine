import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-TAX-13", () => {
  test("the place of supply follows the site address, picks IGST out of state, and switches item lines when it changes", async ({ page }) => {
    await signUpNewOrg(page, { name: "Anita", email: `e2e-tax-13-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const send = async <T>(method: "post" | "put", path: string, data: unknown) =>
      (await (await page.request[method](`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    await send("put", "/org/tax/profile", { country: "IN" });
    await send("put", "/org/tax/profile", { registrationNumber: "29AAACK0000A1ZK", stateCode: "29", legalName: "Kaveri Interiors" });
    const groups = (await (await page.request.get(`${API_URL}/tax-groups`)).json()) as { id: string; name: string }[];
    const rates = (await (await page.request.get(`${API_URL}/tax-rates`)).json()) as { id: string; name: string }[];
    const gst18 = groups.find((g) => g.name === "GST 18%")!.id;
    const igst18 = rates.find((r) => r.name === "IGST 18%")!.id;
    await send("post", "/catalog-items", { name: "Modular kitchen", unit: "set", defaultPriceAmount: "18000000", defaultPriceCurrency: "INR", defaultTaxGroupId: gst18, interTaxRateId: igst18 });
    await send("post", "/contacts", {
      type: "customer",
      isCompany: true,
      name: "Lakeview Homes LLP",
      gstTreatment: "unregistered",
      addresses: [
        { type: "billing", line1: "MG Road", stateCode: "29" },
        { type: "site", line1: "Beach Road", stateCode: "33" },
      ],
    });

    // The catalogue item shows its intra- and inter-state tax.
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Add item" }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Same state as your business.")).toBeVisible();
    await expect(drawer.getByRole("combobox", { name: "Intra-state tax" })).toContainText("GST 18%");
    await expect(drawer.getByRole("combobox", { name: "Inter-state tax" })).toContainText("IGST 18%");
    await page.keyboard.press("Escape");

    await page.goto("/invoices/new");
    await page.getByRole("combobox").filter({ hasText: "Select a contact…" }).click();
    await page.getByPlaceholder("Search…").fill("Lakeview");
    await page.getByRole("option", { name: /Lakeview Homes LLP/ }).click();
    const pos = page.getByRole("combobox", { name: "Place of supply" });
    await expect(pos).toHaveText("Tamil Nadu (33)");
    await expect(page.getByText("From the site address · Inter-state, so items use their IGST rate.")).toBeVisible();

    // Two lines from the item: IGST out of state. The second one's tax is changed by hand.
    for (let i = 0; i < 2; i++) {
      if (i > 0) await page.getByRole("button", { name: "Add item" }).click();
      const item = page.getByRole("combobox", { name: "Item" }).nth(i);
      await item.click();
      await item.fill("Modular");
      await page.getByRole("listbox", { name: "Catalogue matches" }).getByRole("option", { name: /^Modular kitchen/ }).click();
    }
    const taxes = page.getByRole("combobox").filter({ hasText: /IGST 18%|GST 18%|GST 5%/ });
    await expect(taxes).toHaveCount(2);
    await expect(taxes.nth(0)).toContainText("IGST 18%");
    await taxes.nth(1).click();
    await page.getByRole("option", { name: /^GST 5%/ }).click();

    // Back in my state: the first line switches to GST 18%; the hand-changed one keeps GST 5% and is flagged.
    await pos.click();
    await page.getByRole("option", { name: "Karnataka (29)" }).click();
    await expect(page.getByText("The place of supply changed to Karnataka (29): 1 line switched to CGST + SGST; 1 line you changed by hand keeps its tax — check it.")).toBeVisible();
    await expect(taxes.nth(0)).toContainText("GST 18%");
    await expect(taxes.nth(1)).toContainText("GST 5%");
    await expect(page.getByText("Check this line's tax — the place of supply changed.")).toHaveCount(1);

    await page.getByRole("button", { name: "Save as draft" }).click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Place of supply Karnataka (29) (intra-state)")).toBeVisible();
  });
});
