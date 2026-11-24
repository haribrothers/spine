import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { API_URL, Agent, connectAgentAs, turnOnAgents } from "./agent-helpers";

test.describe("US-MCP-07", () => {
  test("an agent drafts a quote; the person opens it in Spine and its Activity says it was made via the agent for them", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `us-mcp-07-${randomUUID()}@example.com`, password: "TestPassword123!" });
    await turnOnAgents(page);
    const contact = await (await page.request.post(`${API_URL}/contacts`, { data: { type: "customer", name: "Harbour Road Residences" }, headers: { "Idempotency-Key": randomUUID() } })).json();
    const client = await connectAgentAs(page, new Agent("Claude Code"));

    const result = (await client.callTool({ name: "draft_quote", arguments: { contactId: contact.id, title: "Deck repair", lines: [{ name: "Carpentry labour", quantity: 2, unitPriceAmount: "9500" }] } })) as { content: { text: string }[] };
    const { quote, link } = JSON.parse(result.content[0]!.text) as { quote: { id: string }; link: string };
    expect(link).toContain(`/quotes/${quote.id}`);

    await page.goto(`/quotes/${quote.id}`);
    await expect(page.getByTestId("agent-made").first()).toHaveText("via Claude Code for Priya Raman");
    await client.close();
  });
});
