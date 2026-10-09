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

  it("hides the illustration from screen readers and uses made-up work, never the install's data", () => {
    render(<WelcomePage />);
    const illustration = screen.getByTestId("auth-illustration-welcome");
    expect(illustration.getAttribute("aria-hidden")).toBe("true");
    expect(illustration.textContent).toContain("Harborview Construction");
    expect(illustration.textContent).toContain("Payment received");
  });
});
