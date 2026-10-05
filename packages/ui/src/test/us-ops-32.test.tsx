import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Table } from "../components/table";

/**
 * US-OPS-32 (D-131) — light mode's page is a warm grey and everything raised
 * on it stays white, in every place the colours are defined: the design
 * tokens, the web CSS and the native token map.
 */
const root = path.resolve(__dirname, "../../../..");

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const tokens = JSON.parse(readFileSync(path.join(root, "docs/design/tokens.json"), "utf8")) as {
  color: Record<"light" | "dark", Record<string, string>>;
  cssVariables: Record<"light" | "dark", Record<string, string>>;
};
const css = readFileSync(path.join(root, "packages/config/tailwind-preset.css"), "utf8");
const cssLight = css.slice(css.indexOf(":root {"), css.indexOf(':root[data-theme="dark"]'));
const cssDark = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf("@media (prefers-color-scheme: dark)"));
function cssValue(block: string, name: string): string {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block);
  if (!m) throw new Error(`--color-${name} not set to a hex value`);
  return m[1]!.toUpperCase();
}
const nativeSource = readFileSync(path.join(root, "packages/ui-native/src/tokens/colors.ts"), "utf8");
function nativeColor(exportName: "lightColors" | "darkColors", key: string): string {
  const start = nativeSource.indexOf(`export const ${exportName}`);
  const block = nativeSource.slice(start, nativeSource.indexOf("export const", start + 1));
  return new RegExp(`^\\s{2}${key}: "(#[0-9A-Fa-f]{6})"`, "m").exec(block)![1]!.toUpperCase();
}

/** Text and status colours that can sit directly on the page. */
const TEXT_TOKENS = ["on-surface", "on-surface-muted", "primary", "paid", "due-soon", "overdue"];

describe("US-OPS-32 · cards lift off the page in light mode", () => {
  it("light background is #F7F6F3 and surface stays white in tokens, web CSS and native", () => {
    expect(tokens.color.light.background).toBe("#F7F6F3");
    expect(tokens.color.light.surface).toBe("#FFFFFF");
    expect(tokens.cssVariables.light["--color-background"]).toBe("#f7f6f3");
    expect(cssValue(cssLight, "background")).toBe("#F7F6F3");
    expect(cssValue(cssLight, "surface")).toBe("#FFFFFF");
    expect(nativeColor("lightColors", "background")).toBe("#F7F6F3");
    expect(nativeColor("lightColors", "surface")).toBe("#FFFFFF");
  });

  it("dark mode is unchanged", () => {
    expect(tokens.color.dark.background).toBe("#121110");
    expect(tokens.color.dark.surface).toBe("#191815");
    expect(cssValue(cssDark, "background")).toBe("#121110");
    expect(cssValue(cssDark, "surface")).toBe("#191815");
  });

  for (const token of TEXT_TOKENS) {
    it(`light: ${token} passes 4.5:1 on both background and surface`, () => {
      for (const bg of ["background", "surface"]) {
        expect(contrast(tokens.color.light[token]!, tokens.color.light[bg]!), `${token} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("the page shell paints background; cards, tables and secondary buttons paint surface", () => {
    const shell = render(<AppShell data-testid="shell" />).getByTestId("shell");
    expect(shell.className).toContain("bg-background");

    const card = render(<Card data-testid="card" />).getByTestId("card");
    expect(card.className).toContain("bg-surface");

    const secondary = render(<Button variant="secondary">Cancel</Button>).getByRole("button");
    expect(secondary.className).toContain("bg-surface");
    expect(secondary.className).not.toMatch(/(^|\s)bg-transparent/);

    const { container } = render(<Table columns={[{ key: "a", header: "A", render: (r: { a: string }) => r.a }]} data={[{ a: "x" }]} rowKey={(r) => r.a} />);
    expect(container.querySelector("table")!.parentElement!.className).toContain("bg-surface");
  });

  it("focus rings leave a surface-coloured gap, never the page colour", () => {
    expect(render(<Button variant="secondary">Save</Button>).getByRole("button").className).toContain("ring-offset-surface");
  });
});
