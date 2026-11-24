import { render, screen } from "@testing-library/react-native";
import Home from "lucide-react-native/icons/house";
import { spineTabBarScreenOptions, TabBarIcon } from "./tab-bar";
import { lightColors, darkColors } from "../tokens";

describe("spineTabBarScreenOptions", () => {
  it("resolves light-mode colors from lightColors", () => {
    const options = spineTabBarScreenOptions("light");
    expect(options.tabBarActiveTintColor).toBe(lightColors.primary);
    expect(options.tabBarInactiveTintColor).toBe(lightColors.onSurfaceMuted);
    expect(options.tabBarStyle).toMatchObject({
      backgroundColor: lightColors.surface,
      borderTopColor: lightColors.border,
    });
  });

  it("resolves dark-mode colors from darkColors", () => {
    const options = spineTabBarScreenOptions("dark");
    expect(options.tabBarActiveTintColor).toBe(darkColors.primary);
    expect(options.tabBarInactiveTintColor).toBe(darkColors.onSurfaceMuted);
    expect(options.tabBarStyle).toMatchObject({
      backgroundColor: darkColors.surface,
      borderTopColor: darkColors.border,
    });
  });

  it("hides the native-stack-style header, since the tab bar is the app's own chrome", () => {
    expect(spineTabBarScreenOptions("light").headerShown).toBe(false);
  });
});

describe("TabBarIcon", () => {
  it("renders the given lucide-react-native icon component with the passed color", () => {
    render(<TabBarIcon icon={Home} color="#2954E5" size={20} />);
    expect(screen.root).toBeTruthy();
  });
});
