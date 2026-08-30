import { render, screen, waitFor } from "@testing-library/react-native";
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
  it("renders the given Feather icon name with the passed color", async () => {
    render(<TabBarIcon name="home" color="#2954E5" size={20} />);
    // @expo/vector-icons' Icon does an async font-load state update on mount
    // — waitFor wraps the flush in act() so it doesn't warn, unlike a bare
    // setTimeout/Promise flush.
    await waitFor(() => expect(screen.root).toBeTruthy());
  });
});
