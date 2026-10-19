import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

/** A stand-in OpenAI-compatible provider on this machine: lists models and answers one-token chats. No real provider is ever called. */
async function startStub(): Promise<{ url: string; host: string; server: Server }> {
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      if (req.url === "/v1/models") res.end(JSON.stringify({ data: [{ id: "llama3.2-vision" }, { id: "qwen2.5:14b" }] }));
      else res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "OK" } }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/v1`, host: `127.0.0.1:${port}`, server };
}

test.describe("US-AI-01 · US-AI-02", () => {
  test("an Owner connects a local model, tests it, switches AI on, moves to Anthropic after confirming, and switches it off", async ({ page }) => {
    const stub = await startStub();
    try {
      await signUpNewOrg(page, { name: "Owner", email: `us-ai-01-${randomUUID()}@example.com`, password: "TestPassword123!" });
      await page.goto("/dashboard?settings=ai");
      const pane = page.getByTestId("ai-pane");
      await expect(pane.getByText("AI helps fill in forms — reading bills and receipts, drafting emails and quote lines, suggesting bank matches. It never saves, sends or posts anything by itself.")).toBeVisible();

      // US-AI-01: no provider yet.
      const aiSwitch = pane.getByRole("switch", { name: "AI assistant" });
      await expect(aiSwitch).toHaveAttribute("aria-checked", "false");
      await aiSwitch.click();
      await expect(pane.getByRole("alert")).toHaveText("Connect a provider first.");

      // US-AI-02: a model on this machine.
      await pane.getByRole("radio", { name: "Local or OpenAI-compatible" }).click();
      await pane.getByLabel("Server address").fill(stub.url);
      await pane.getByRole("combobox", { name: "Model" }).click();
      await page.getByRole("option", { name: "llama3.2-vision" }).click();
      await pane.getByRole("button", { name: "Test connection" }).click();
      await expect(pane.getByTestId("ai-connection")).toHaveText("Connected · llama3.2-vision · reads images: yes");
      await pane.getByRole("button", { name: "Save" }).click();
      await expect(page.getByTestId("toast").getByText("AI provider saved").first()).toBeVisible();

      // On the local network: on without a question.
      await aiSwitch.click();
      await expect(page.getByTestId("toast").getByText("AI assistant is on").first()).toBeVisible();
      await expect(aiSwitch).toHaveAttribute("aria-checked", "true");

      // Modules shows it as the fifth module, linking here.
      await page.goto("/dashboard?settings=modules");
      await expect(page.getByTestId("module-ai")).toContainText(`On · ${stub.host}`);
      await page.getByTestId("module-ai").getByRole("button", { name: "Set up in AI assistant" }).click();
      await expect(page).toHaveURL(/settings=ai/);

      // Anthropic with a key: moving off the local network asks first.
      await pane.getByRole("radio", { name: "Anthropic Claude" }).click();
      await pane.getByLabel("API key").fill("sk-ant-e2e-test-00001a2b");
      await pane.getByRole("combobox", { name: "Model" }).click();
      await page.getByPlaceholder("Search…").fill("claude-sonnet-5-5");
      await page.getByRole("option", { name: /claude-sonnet-5-5/ }).click();
      await pane.getByRole("button", { name: "Save" }).click();
      const confirm = page.getByRole("alertdialog");
      await expect(confirm).toContainText("Business data will be sent to api.anthropic.com when people use AI features.");
      await confirm.getByRole("button", { name: "Use this provider" }).click();
      await expect(page.getByTestId("toast").getByText("AI provider saved").first()).toBeVisible();
      await expect(pane.locator('input[value="••••1a2b"]')).toBeVisible();

      // Off asks first, and says nothing saved changes.
      await aiSwitch.click();
      await expect(page.getByRole("alertdialog")).toContainText("AI buttons disappear for everyone. Nothing already saved changes.");
      await page.getByRole("alertdialog").getByRole("button", { name: "Turn off AI" }).click();
      await expect(page.getByTestId("toast").getByText("AI assistant is off").first()).toBeVisible();
      await expect(aiSwitch).toHaveAttribute("aria-checked", "false");
    } finally {
      await new Promise((resolve) => stub.server.close(resolve));
    }
  });
});
