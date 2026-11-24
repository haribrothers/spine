import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { BottomTabBar, type BottomTabBarItem } from "./bottom-tab-bar";

const ITEMS: BottomTabBarItem[] = [
  { key: "home", href: "/dashboard", label: "Home", icon: <svg aria-hidden />, current: false },
  { key: "sales", href: "/quotes", label: "Sales", icon: <svg aria-hidden />, current: true },
  { key: "more", href: "#", label: "More", icon: <svg aria-hidden />, current: false },
];

function Bar() {
  return (
    <BottomTabBar
      items={ITEMS}
      buttonKeys={["more"]}
      renderLink={(item, props) => (
        <a href={item.href} className={props.className} aria-current={props["aria-current"]}>
          {props.children}
        </a>
      )}
      renderButton={(_item, props) => (
        <button type="button" className={props.className}>
          {props.children}
        </button>
      )}
    />
  );
}

describe("BottomTabBar a11y", () => {
  it("has no violations", async () => {
    const { container } = render(<Bar />);
    await expectNoA11yViolations(container);
  });

  it("US-OPS-54: is a navigation landmark named Main, with the current tab marked by more than colour", () => {
    render(<Bar />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.hasAttribute("data-tabbar")).toBe(true);
    const current = screen.getByRole("link", { name: "Sales" });
    expect(current.getAttribute("aria-current")).toBe("page");
    // A tinted pill behind the icon and a heavier label, not just a colour.
    expect(current.querySelector("span")?.className).toContain("bg-info-bg");
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
  });
});
