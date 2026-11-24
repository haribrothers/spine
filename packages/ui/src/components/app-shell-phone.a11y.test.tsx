import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { AppShellAreaNav, AppShellPhoneBar } from "./app-shell-phone";

const link = (item: { href: string; label: string }, props: { className: string; "aria-current"?: "page"; children: React.ReactNode }) => (
  <a href={item.href} className={props.className} aria-current={props["aria-current"]}>
    {props.children}
  </a>
);

describe("AppShellPhoneBar and AppShellAreaNav a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <>
        <AppShellPhoneBar title="Invoice" onBack={() => {}} actions={<button type="button" aria-label="Search" />} />
        <AppShellAreaNav
          label="Money"
          renderLink={link}
          items={[
            { href: "/invoices", label: "Invoices", current: true },
            { href: "/payments", label: "Payments", current: false },
          ]}
        />
      </>,
    );
    await expectNoA11yViolations(container);
  });

  it("US-OPS-54: shows the page's title and, when there's somewhere to go, a back arrow", () => {
    const onBack = vi.fn();
    const { rerender } = render(<AppShellPhoneBar title="Invoices" />);
    expect(screen.getByTestId("app-top-bar-title").textContent).toBe("Invoices");
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    rerender(<AppShellPhoneBar title="Invoice" onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("US-OPS-54: the area row marks the current page and leaves itself out with one page", () => {
    const { rerender } = render(<AppShellAreaNav label="Money" renderLink={link} items={[{ href: "/invoices", label: "Invoices", current: true }, { href: "/payments", label: "Payments", current: false }]} />);
    expect(screen.getByRole("navigation", { name: "Money" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Invoices" }).getAttribute("aria-current")).toBe("page");
    rerender(<AppShellAreaNav label="Jobs" renderLink={link} items={[{ href: "/jobs", label: "Jobs", current: true }]} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
