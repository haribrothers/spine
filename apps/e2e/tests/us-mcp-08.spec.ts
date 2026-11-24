import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { API_URL, Agent, connectAgentAs, turnOnAgents } from "./agent-helpers";

test.describe("US-MCP-08", () => {
  test("Team › Audit log › Agent request shows who, the agent, what it did, the record (opens it) and how it ended", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `us-mcp-08-${randomUUID()}@example.com`, password: "TestPassword123!" });
    await turnOnAgents(page);
    const contact = await (await page.request.post(`${API_URL}/contacts`, { data: { type: "customer", name: "Harbour Road Residences" }, headers: { "Idempotency-Key": randomUUID() } })).json();
    const client = await connectAgentAs(page, new Agent("Claude Code"));
    const result = (await client.callTool({ name: "draft_quote", arguments: { contactId: contact.id, lines: [{ name: "Carpentry labour", quantity: 2, unitPriceAmount: "9500" }] } })) as { content: { text: string }[] };
    const { quote } = JSON.parse(result.content[0]!.text) as { quote: { id: string } };
    await client.callTool({ name: "get_record", arguments: { type: "quote", number: "Q-9999" } });
    await client.close();

    await page.goto("/team/audit-log");
    await page.getByRole("combobox", { name: "Record type" }).click();
    await page.getByRole("option", { name: "Agent request", exact: true }).click();
    const table = page.getByTestId("audit-table");
    const drafted = table.locator("tr", { hasText: "Drafted a quote" });
    await expect(drafted).toContainText("Priya Raman");
    await expect(drafted).toContainText("Claude Code · Worked");
    await expect(table.locator("tr", { hasText: "Read a quote" })).toContainText("Claude Code · Refused — No quote Q-9999 that you can open.");
    await drafted.getByRole("link", { name: "Quote · Draft quote" }).click();
    await expect(page).toHaveURL(new RegExp(`/quotes/${quote.id}$`));
  });
});
