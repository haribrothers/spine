import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { signUpNewOrg } from "./helpers";
import { Agent, transportFor, turnOnAgents } from "./agent-helpers";

test.describe("US-MCP-03", () => {
  test("an agent sends a signed-out person to Spine's log-in; they log in, see what it can do, untick drafts and Allow; the agent connects", async ({ page, browser }) => {
    const email = `us-mcp-03-${randomUUID()}@example.com`;
    const password = "TestPassword123!";
    await signUpNewOrg(page, { name: "Priya Raman", email, password });
    await turnOnAgents(page);

    // The agent is refused and asks the person to sign in.
    const agent = new Agent();
    const first = transportFor(agent);
    await new Client({ name: "e2e", version: "1.0.0" }).connect(first).catch(() => {});
    expect(agent.url).not.toBeNull();

    // A browser with nobody signed in follows the agent's link.
    const context = await browser.newContext();
    const tab = await context.newPage();
    let callback: string | null = null;
    await tab.route("http://localhost:47998/**", async (route) => {
      callback = route.request().url();
      await route.fulfill({ status: 200, contentType: "text/plain", body: "Back in the agent" });
    });
    await tab.goto(agent.url!.toString());
    await expect(tab.getByTestId("agent-signin-note")).toContainText("is asking to connect to Spine. Log in to choose what it can do.");
    await tab.getByLabel("Email").fill(email);
    await tab.getByRole("textbox", { name: "Password" }).fill(password);
    await tab.getByRole("button", { name: "Log in" }).click();

    // The consent page, for this person and role.
    const consent = tab.getByTestId("agent-consent");
    await expect(consent.getByRole("heading", { name: "localhost:47998 wants to use Spine as you" })).toBeVisible();
    await expect(consent.getByTestId("agent-host")).toContainText("Unverified name");
    await expect(consent).toContainText("Signed in as Priya Raman");
    await expect(consent).toContainText("Read what you can see in Spine");
    await expect(consent).toContainText("It can't issue, send, record payments, delete or change settings.");
    await consent.getByRole("checkbox").click();
    await consent.getByRole("button", { name: "Allow" }).click();

    await expect.poll(() => callback, { timeout: 15_000 }).toContain("code=");
    const code = new URL(callback!).searchParams.get("code")!;
    await first.finishAuth(code);
    const connected = transportFor(agent);
    const client = new Client({ name: "e2e", version: "1.0.0" });
    await client.connect(connected);
    expect(await client.ping()).toBeDefined();
    expect(agent.tokens()!.scope ?? "").not.toContain("spine:draft");
    await client.close();
    await context.close();
  });
});
