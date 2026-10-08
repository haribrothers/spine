import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react-native";
import TabsLayout from "../../app/(tabs)/_layout";
import { useTabHeaderOptions } from "../components/header-items";

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
    render(<TabsLayout />);
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

  it("lets large titles collapse: every header-backed ScrollView adjusts its insets automatically", () => {
    const offenders = allSources.filter((file) => {
      const src = readFileSync(file, "utf8");
      if (!src.includes("<ScrollView") || src.includes("SafeAreaView")) return false;
      return (src.match(/<ScrollView\b/g) ?? []).length > (src.match(/contentInsetAdjustmentBehavior="automatic"/g) ?? []).length;
    });
    expect(offenders).toEqual([]);
  });

  it("follows dark mode: every themed colour class carries its dark: pair", () => {
    const THEMED = /^(?:bg|text|border)-(?:background|surface|surface-sunken|on-surface|on-surface-muted|on-primary|primary|overdue|overdue-bg|due-soon|due-soon-bg|paid|paid-bg|draft|draft-bg|info|info-bg|border|border-strong)$/;
    const missing: string[] = [];
    for (const file of allSources) {
      for (const match of readFileSync(file, "utf8").matchAll(/className="([^"]+)"/g)) {
        const classes = match[1]!.split(/\s+/);
        for (const cls of classes) if (THEMED.test(cls) && !classes.includes(`dark:${cls}-dark`)) missing.push(`${file.replace(appRoot, "")}: ${cls}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
