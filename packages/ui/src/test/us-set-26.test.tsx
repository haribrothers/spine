import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SPINE_LOGO_MIN, SPINE_MARK_LAYERS, SPINE_WORDMARK, SpineLogo } from "../components/spine-logo";

/**
 * US-SET-26 (D-206) — the Spine logo across the web app: one SpineLogo with a
 * fixed brand wordmark colour, the same artwork as the phone, the icons a
 * browser and home screen use, and no old logo images left behind.
 */
const root = path.resolve(__dirname, "../../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const css = read("packages/config/tailwind-preset.css").replace(/\/\*[\s\S]*?\*\//g, "");

/** Declarations of every rule whose selector matches `test`. */
function declarations(test: (selector: string) => boolean): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!test(m[1]!.trim().split("\n").pop()!.trim())) continue;
    for (const d of m[2]!.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[d[1]!] = d[2]!.trim().toLowerCase();
  }
  return out;
}

function png(file: string): { width: number; height: number } {
  const bytes = readFileSync(path.join(root, file));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function files(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (name === "node_modules" || name === ".next") return [];
    return statSync(path.join(root, rel)).isDirectory() ? files(rel) : [rel];
  });
}

describe("US-SET-26 · see the Spine logo across the web app", () => {
  it("keeps the brand colours as tokens outside the theme rules, with a light-text wordmark in dark mode", () => {
    const light = declarations((s) => s === ":root");
    expect(light).toMatchObject({ "color-brand-teal": "#04e9bc", "color-brand-sky": "#51a5f8", "color-brand-deep": "#054dc1", "color-brand-wordmark": "#2954e5" });
    const tokens = JSON.parse(read("docs/design/tokens.json")) as { color: { brand: Record<string, string>; gradients: { brand: Record<string, [string, string]> } } };
    expect(light["color-brand-teal"]).toBe(tokens.color.brand.teal!.toLowerCase());
    for (const layer of ["top", "mid", "base"]) {
      const [from, to] = tokens.color.gradients.brand[`layer-${layer}`]!;
      expect([light[`color-brand-layer-${layer}-from`], light[`color-brand-layer-${layer}-to`]]).toEqual([from.toLowerCase(), to.toLowerCase()]);
    }
    expect(declarations((s) => s === ':root[data-theme="dark"]')["color-brand-wordmark"]).toBe("#f3f2ee");
    expect(declarations((s) => s === ':root:not([data-theme="light"])')["color-brand-wordmark"]).toBe("#f3f2ee");
    // A business's theme (US-SET-09) changes primary, never the logo.
    expect(Object.keys(declarations((s) => s.includes("[data-brand=")))).not.toContain("color-brand-wordmark");
  });

  it("draws the wordmark in the brand colour, never primary, and the mark from the brand gradients", () => {
    const { container } = render(<SpineLogo variant="horizontal" />);
    const letters = [...container.querySelectorAll("path")].filter((p) => (p as SVGPathElement).style.fill);
    expect(letters.length).toBe(SPINE_WORDMARK.length);
    for (const letter of letters) expect((letter as SVGPathElement).style.fill).toBe("var(--color-brand-wordmark)");
    expect(container.innerHTML).not.toMatch(/--color-primary/);
    expect(container.innerHTML).toMatch(/--color-brand-layer-top-from/);
  });

  it("is named Spine, or hidden when decorative, and never smaller than the brand minimum", () => {
    render(<SpineLogo variant="mark" size={8} />);
    const mark = screen.getByRole("img", { name: "Spine" });
    expect(mark.getAttribute("width")).toBe(String(SPINE_LOGO_MIN.mark));
    const { container } = render(<SpineLogo variant="vertical" size={40} decorative />);
    const lockup = container.querySelector("svg")!;
    expect(lockup.getAttribute("aria-hidden")).toBe("true");
    expect(lockup.getAttribute("width")).toBe(String(SPINE_LOGO_MIN.lockup));
  });

  it("uses the same artwork as the phone app", () => {
    const native = read("packages/ui-native/src/components/spine-logo.tsx");
    for (const layer of SPINE_MARK_LAYERS) expect(native).toContain(layer.d);
    for (const letter of SPINE_WORDMARK) expect(native).toContain(letter);
  });

  it("puts the logo in the sidebar (the mark when collapsed), the sign-in pages and the public quote footer", () => {
    const layout = read("apps/web/src/components/app-layout.tsx");
    expect(layout).toContain('<SpineLogo variant="mark" size={28} />');
    expect(layout).toContain('<SpineLogo variant="horizontal" size={96} />');
    expect(layout).not.toMatch(/>S<\/span>/);
    // US-ONB-22: onboarding's start and finish use AuthFrame; the steps carry the logo in their rail.
    expect(read("apps/web/src/app/onboarding/page.tsx")).toContain("<AuthFrame");
    expect(read("apps/web/src/app/onboarding/onboarding-shell.tsx")).toContain('<SpineLogo variant="horizontal" size={96} />');
    // US-AUTH-13, US-AUTH-14 (D-207): every signed-out page now sits in AuthFrame, which carries the logo.
    expect(read("apps/web/src/components/auth-frame.tsx")).toContain('<SpineLogo variant="horizontal" size={96} />');
    for (const page of ["apps/web/src/app/login/page.tsx", "apps/web/src/app/signup/page.tsx", "apps/web/src/app/accept-invite/[id]/accept-invite-view.tsx"]) {
      expect(read(page)).toContain("<AuthFrame");
    }
    // US-OPS-16: the text comes from the shared English strings.
    expect(read("apps/web/src/app/quote/[token]/public-quote-view.tsx")).toMatch(/<SpineLogo decorative size=\{20\} \/>\s*\{t\("publicQuote\.sentWithSpine"\)\}/);
    expect(JSON.parse(read("packages/shared/src/i18n/en.json")).publicQuote.sentWithSpine).toBe("Sent with Spine");
  });

  it("gives browsers and home screens the app icon, and keeps Spine a normal website", () => {
    expect(read("apps/web/src/app/icon.svg")).toMatch(/#04E9BC[\s\S]*#054DC1/);
    const ico = readFileSync(path.join(root, "apps/web/src/app/favicon.ico"));
    expect(ico.readUInt16LE(4)).toBe(3); // 16, 32 and 48 px
    expect(png("apps/web/src/app/apple-icon.png")).toEqual({ width: 180, height: 180 });
    const manifest = read("apps/web/src/app/manifest.ts");
    expect(manifest).toContain('display: "browser"');
    for (const [icon, size] of [["icon-192", 192], ["icon-512", 512], ["icon-maskable-512", 512]] as const) {
      expect(manifest).toContain(`/icons/${icon}.png`);
      expect(png(`apps/web/public/icons/${icon}.png`)).toEqual({ width: size, height: size });
    }
    expect(manifest).toContain('purpose: "maskable"');
    expect(read("apps/web/src/app/layout.tsx")).toMatch(/themeColor:[\s\S]*#F7F6F3[\s\S]*#121110/);
    const sw = read("apps/web/public/sw.js");
    expect(sw).toContain('icon: "/icons/notification-192.png"');
    expect(sw).toContain('badge: "/icons/badge-96.png"');
  });

  it("documents SpineLogo and leaves no old logo images behind", () => {
    expect(existsSync(path.join(root, "apps/design-system/src/app/components/spine-logo/page.tsx"))).toBe(true);
    expect(read("apps/design-system/src/app/foundation/color/page.mdx")).toContain("--color-brand-wordmark");
    const sources = [...files("apps/web/src"), ...files("apps/web/public"), ...files("apps/design-system/src")];
    expect(sources.filter((f) => /spine-logo-(horizontal|vertical)/.test(f))).toEqual([]);
    expect(sources.filter((f) => /\.(tsx?|mdx|js)$/.test(f) && /spine-logo-(horizontal|vertical)/.test(read(f)))).toEqual([]);
  });
});
