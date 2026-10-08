import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react-native";
import TabsLayout from "../../app/(tabs)/_layout";
import { useTabHeaderOptions } from "../components/header-items";
import { renderWithSession } from "../test-utils/session";
import { darkColors } from "@spine/ui-native/tokens";

jest.mock("expo-router/unstable-native-tabs", () => {
  const { Text: MockText, View: MockView } = jest.requireActual("react-native");
  function Trigger({ name, role, children }: { name: string; role?: string; children?: React.ReactNode }) {
    return (
      <MockView testID={`tab-${name}`} accessibilityHint={role}>
        {children}
      </MockView>
    );
  }
  Trigger.Icon = function Icon({ sf, md }: { sf: { default: string }; md: string }) {
    return <MockText>{`icon:${sf.default}/${md}`}</MockText>;
  };
  Trigger.Label = function Label({ children }: { children: string }) {
    return <MockText>{children}</MockText>;
  };
  function NativeTabs({ children }: { children: React.ReactNode }) {
    return <MockView>{children}</MockView>;
  }
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});
jest.mock("../components/header-items", () => ({ ...jest.requireActual("../components/header-items"), ProfileAvatarButton: () => null }));

const appRoot = join(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "test-utils" ? [] : sourceFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}
const allSources = [...sourceFiles(join(appRoot, "app")), ...sourceFiles(join(appRoot, "src"))];

describe("US-MOB-19 · run the field app on native tabs", () => {
  it("has native tabs Today, Jobs and Expenses, plus Search as the iOS search tab", () => {
    renderWithSession(<TabsLayout />);
    for (const [name, label] of [["(today)", "Today"], ["jobs", "Jobs"], ["expenses", "Expenses"]] as const) {
      expect(screen.getByTestId(`tab-${name}`)).toBeTruthy();
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByTestId("tab-search").props.accessibilityHint).toBe("search");
    expect(screen.getByText("icon:house/today")).toBeTruthy();
  });

  it("gives each tab a large title with the avatar on iOS", () => {
    const options = useTabHeaderOptions("Today", "ios");
    expect(options).toMatchObject({ title: "Today", headerLargeTitleEnabled: true });
    expect("unstable_headerRightItems" in options).toBe(true);
  });

  it("is an expo-router app with no React Navigation or FloatingTabBar of its own", () => {
    const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8")) as { main: string; dependencies: Record<string, string> };
    expect(pkg.main).toBe("expo-router/entry");
    expect(Object.keys(pkg.dependencies).filter((dep) => dep.startsWith("@react-navigation/"))).toEqual([]);
    expect(allSources.filter((file) => readFileSync(file, "utf8").includes("FloatingTabBar"))).toEqual([]);
  });

  it("lets large titles collapse: every header-backed scroll view or list adjusts its insets automatically", () => {
    const offenders = allSources.filter((file) => {
      const src = readFileSync(file, "utf8");
      if (src.includes("SafeAreaView")) return false;
      // Vertical scrollers only: a horizontal carousel inside a screen isn't under the header.
      const vertical = (src.match(/<(?:ScrollView|FlatList|SectionList)\b(?![^>]*\bhorizontal\b)/g) ?? []).length;
      // "automatic" under a header; "never" only where the screen pads for the safe area itself (a headerless full-screen modal).
      return vertical > (src.match(/contentInsetAdjustmentBehavior="(?:automatic|never)"/g) ?? []).length;
    });
    expect(offenders).toEqual([]);
  });

  it("follows dark mode: every themed colour class carries its dark: pair", () => {
    const THEMED = /^(?:bg|text|border)-(?:background|surface|surface-sunken|on-surface|on-surface-muted|on-primary|primary|overdue|overdue-bg|due-soon|due-soon-bg|paid|paid-bg|draft|draft-bg|info|info-bg|border|border-strong)$/;
    const missing: string[] = [];
    for (const file of allSources) {
      // Every string or template literal: class lists are also built in ternaries and template strings.
      for (const match of readFileSync(file, "utf8").matchAll(/"([^"\n]*)"|`([^`]*)`/g)) {
        const classes = (match[1] ?? match[2] ?? "").split(/\s+/).map((cls) => cls.replace(/^[`"'{(]+|[`"'})]+$/g, ""));
        for (const cls of classes) if (THEMED.test(cls) && !classes.includes(`dark:${cls}-dark`)) missing.push(`${file.replace(appRoot, "")}: ${cls}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("draws Today and a job in iOS dark mode from the MobHomeDark / MobJobDetailDark roles", () => {
    expect({ background: darkColors.background, surface: darkColors.surface, primary: darkColors.primary, onPrimary: darkColors.onPrimary }).toEqual({ background: "#121110", surface: "#191815", primary: "#6B8AFF", onPrimary: "#121110" });
    const today = readFileSync(join(appRoot, "src/features/today/today-screen.tsx"), "utf8");
    const job = readFileSync(join(appRoot, "src/features/jobs/job-detail-screen.tsx"), "utf8");
    for (const src of [today, job]) expect(src).toContain("bg-background dark:bg-background-dark");
    expect(job).toContain("bg-surface dark:border-border-dark dark:bg-surface-dark");
    expect(job).toContain("text-on-primary dark:text-on-primary-dark");
  });
});
