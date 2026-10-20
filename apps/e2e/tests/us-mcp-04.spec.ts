import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { Agent, connectAgentAs, turnOnAgents } from "./agent-helpers";

test.describe("US-MCP-04", () => {
  test("a person sees the agent they connected and disconnects it after confirming; the Owner's pane lists it too", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `us-mcp-04-${randomUUID()}@example.com`, password: "TestPassword123!" });
    await turnOnAgents(page);
    const client = await connectAgentAs(page, new Agent("Claude Code"));

    // The Owner's Connections card.
    await page.goto("/dashboard?settings=agents");
    const all = page.getByTestId("agents-pane").getByTestId("agent-connection");
    await expect(all).toHaveCount(1);
    await expect(all.first()).toContainText("Claude Code");
    await expect(all.first()).toContainText("Priya Raman");
    await expect(all.first()).toContainText("Unverified name");

    // Your account › Connected agents.
    await page.goto("/dashboard?settings=my-connected-agents");
    const pane = page.getByTestId("my-agents-pane");
    await expect(pane.getByTestId("agent-connection")).toContainText("Read and create drafts");
    await pane.getByRole("button", { name: "Disconnect Claude Code" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Disconnect Claude Code?" });
    await expect(confirm).toContainText("It stops working at once.");
    await confirm.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByTestId("toast").getByText("Claude Code disconnected").first()).toBeVisible();
    await expect(pane.getByText("No agents connected")).toBeVisible();

    // The agent is refused from now on.
    await expect(client.ping()).rejects.toThrow();
  });
});
