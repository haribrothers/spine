import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WelcomePage from "../app/welcome/page";

describe("US-AUTH-13 · the welcome page", () => {
  it("says what Spine is, what happens next and starts the first account", () => {
    render(<WelcomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Run your business on Spine" })).toBeTruthy();
    expect(screen.getByText("Quotes, jobs, invoices and your books in one place — on your own server.")).toBeTruthy();
    expect(within(screen.getByRole("list")).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "1Create your account",
      "2Set up your business in a few minutes",
      "3Invite your team",
    ]);
    expect(screen.getByRole("link", { name: "Create your account" }).getAttribute("href")).toBe("/signup");
    expect(screen.getByRole("img", { name: "Spine" })).toBeTruthy();
  });

  it("hides the illustration from screen readers; its people and cards show the story, never names or amounts", () => {
    render(<WelcomePage />);
    const illustration = screen.getByTestId("auth-illustration-welcome");
    expect(illustration.getAttribute("aria-hidden")).toBe("true");
    // The team from the people sprite (Open Peeps, CC0), coloured by the illustration tokens.
    expect([...illustration.querySelectorAll("use")].map((u) => u.getAttribute("href"))).toEqual([
      "/illustrations/people.svg#trades",
      "/illustrations/people.svg#owner",
      "/illustrations/people.svg#customer",
    ]);
    // Only the caption and the statuses are words: no names, document numbers or amounts.
    const text = illustration.textContent ?? "";
    expect(text).toContain("From quote to paid, in one place.");
    for (const status of ["Accepted", "Paid"]) expect(text).toContain(status);
    expect(text).not.toMatch(/\$|\d/);
  });

  it("ships a sprite the browser can parse, with every person the pages use", () => {
    // An invalid sprite (e.g. "--" inside an XML comment) draws nothing and fails silently.
    const source = readFileSync(path.join(__dirname, "../../public/illustrations/people.svg"), "utf8");
    const doc = new DOMParser().parseFromString(source, "image/svg+xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect([...doc.querySelectorAll("symbol")].map((s) => s.id)).toEqual(["trades", "owner", "customer", "morning"]);
    expect(source).toContain("var(--color-illustration-ink)");
    expect(source).not.toMatch(/fill="#/);
  });
});
