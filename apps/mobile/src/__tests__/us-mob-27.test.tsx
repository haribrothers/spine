import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as nativewind from "nativewind";
import { render, screen } from "@testing-library/react-native";
import { SpineLogo, SPINE_LOGO_MIN } from "@spine/ui-native";
import { brandColors, darkColors, lightColors } from "@spine/ui-native/tokens";

const ROOT = join(__dirname, "../../../..");

type Node = ReturnType<typeof screen.UNSAFE_root.findAll>[number];
/** The solid fills drawn by the logo (the wordmark's letters). */
function solidFills(): string[] {
  return screen.UNSAFE_root.findAll((node: Node) => typeof node.props.fill === "string" && !String(node.props.fill).startsWith("url(") && Boolean(node.props.d)).map(
    (node: Node) => node.props.fill as string,
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" || name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("US-MOB-27 · use the Spine brand the same way everywhere in the app", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps the brand colours and gradients in tokens.json, the same as ui-native's tokens", () => {
    const tokens = JSON.parse(readFileSync(join(ROOT, "docs/design/tokens.json"), "utf8")) as {
      color: { brand: Record<string, string>; gradients: { brand: Record<string, [string, string]> } };
    };
    expect(tokens.color.brand).toMatchObject({ teal: brandColors.teal, sky: brandColors.sky, deep: brandColors.deep });
    expect(tokens.color.brand).toMatchObject({ teal: "#04E9BC", sky: "#51A5F8", deep: "#054DC1" });
    const g = brandColors.gradients;
    expect(tokens.color.gradients.brand).toEqual({
      icon: [g.icon.from, g.icon.to],
      "layer-top": [g.layerTop.from, g.layerTop.to],
      "layer-mid": [g.layerMid.from, g.layerMid.to],
      "layer-base": [g.layerBase.from, g.layerBase.to],
    });
    expect(g.icon).toEqual({ from: "#04E9BC", to: "#054DC1" });
  });

  it("draws the logo in primary in light mode and in light text in dark mode", () => {
    render(<SpineLogo variant="horizontal" />);
    expect(new Set(solidFills())).toEqual(new Set([lightColors.primary]));
    screen.unmount();

    jest.spyOn(nativewind, "useColorScheme").mockReturnValue({ colorScheme: "dark", setColorScheme: jest.fn(), toggleColorScheme: jest.fn() } as never);
    render(<SpineLogo variant="vertical" />);
    expect(new Set(solidFills())).toEqual(new Set([darkColors.onSurface]));
  });

  it("draws the mark alone with the three layer gradients and no wordmark", () => {
    render(<SpineLogo variant="mark" />);
    expect(solidFills()).toEqual([]);
    const stops = screen.UNSAFE_root.findAll((node: Node) => typeof node.props.stopColor === "string").map((node: Node) => node.props.stopColor as string);
    for (const layer of [brandColors.gradients.layerTop, brandColors.gradients.layerMid, brandColors.gradients.layerBase]) {
      expect(stops).toEqual(expect.arrayContaining([layer.from, layer.to]));
    }
  });

  it("is read as “Spine”, or hidden when decorative", () => {
    render(<SpineLogo variant="vertical" />);
    expect(screen.getByLabelText("Spine")).toBeTruthy();
    screen.unmount();
    render(<SpineLogo variant="vertical" decorative />);
    expect(screen.queryByLabelText("Spine")).toBeNull();
  });

  it("never draws below the brand minimum", () => {
    render(<SpineLogo variant="mark" size={8} testID="mark" />);
    expect(screen.getByTestId("mark").props.style).toMatchObject({ width: SPINE_LOGO_MIN.mark, height: SPINE_LOGO_MIN.mark });
    screen.unmount();
    render(<SpineLogo variant="horizontal" size={40} testID="lockup" />);
    expect(screen.getByTestId("lockup").props.style).toMatchObject({ width: SPINE_LOGO_MIN.lockup });
  });

  it("never uses a brand colour for text or status", () => {
    const files = [...sourceFiles(join(ROOT, "packages/ui-native/src")), ...sourceFiles(join(ROOT, "apps/mobile/src")), ...sourceFiles(join(ROOT, "apps/mobile/app"))];
    const misuse = files.filter((file) => /\bcolor\s*[:=]\s*\{?\s*brandColors\b/.test(readFileSync(file, "utf8")));
    expect(misuse).toEqual([]);
    // No Tailwind class exists for them, so `text-brand…` can't be written either.
    const preset = readFileSync(join(ROOT, "packages/ui-native/tailwind-preset.js"), "utf8");
    expect(preset).not.toMatch(/brand/);
  });

  it("shares its artwork with the web app's logo (US-SET-26, D-206)", () => {
    // The web draws the same paths through @spine/ui's own SpineLogo; it never imports the native one.
    const web = readFileSync(join(ROOT, "packages/ui/src/components/spine-logo.tsx"), "utf8");
    const native = readFileSync(join(ROOT, "packages/ui-native/src/components/spine-logo.tsx"), "utf8");
    for (const d of native.match(/"M[0-9][^"]+Z"/g) ?? []) expect(web).toContain(d);
    expect(sourceFiles(join(ROOT, "apps/web/src")).filter((file) => /@spine\/ui-native/.test(readFileSync(file, "utf8")))).toEqual([]);
  });

  it("documents SpineLogo in the showcase app", () => {
    expect(readFileSync(join(ROOT, "apps/showcase-native/src/components/demos/spine-logo-demo.tsx"), "utf8")).toContain("<SpineLogo");
    expect(readFileSync(join(ROOT, "apps/showcase-native/src/lib/component-catalog.ts"), "utf8")).toContain('slug: "spine-logo"');
  });
});
