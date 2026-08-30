import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { FloatingTabBar } from "./floating-tab-bar";
import { TabBarIcon, type TabBarIconName } from "./tab-bar";
import { lightColors, darkColors } from "../tokens";

/**
 * `BottomTabBarProps` is normally supplied by React Navigation itself when
 * it calls the `tabBar` render prop — this test constructs the minimal
 * shape by hand (two routes, one focused) rather than mounting a real
 * `Tab.Navigator`, since `FloatingTabBar`'s own logic (which colors, which
 * label, which accessibility state) is what's under test, not React
 * Navigation's routing.
 */
function makeIconOption(name: TabBarIconName) {
  function IconOption(props: { focused: boolean; color: string; size: number }) {
    return <TabBarIcon name={name} {...props} />;
  }
  return IconOption;
}

function makeProps(overrides: { focusedIndex?: number } = {}) {
  const navigate = jest.fn();

  const props: BottomTabBarProps = {
    state: {
      index: overrides.focusedIndex ?? 0,
      routes: [
        { key: "home-key", name: "Home" },
        { key: "jobs-key", name: "Jobs" },
      ],
    } as BottomTabBarProps["state"],
    descriptors: {
      "home-key": { options: { title: "Home", tabBarIcon: makeIconOption("home") } },
      "jobs-key": { options: { title: "Jobs", tabBarIcon: makeIconOption("briefcase") } },
    } as unknown as BottomTabBarProps["descriptors"],
    navigation: { emit: () => ({ defaultPrevented: false }), navigate } as unknown as BottomTabBarProps["navigation"],
    insets: { top: 0, bottom: 20, left: 0, right: 0 },
  };

  return { props, navigate };
}

describe("FloatingTabBar", () => {
  it("marks the focused tab as selected and shows every tab's label (icon above, label below)", async () => {
    const { props } = makeProps({ focusedIndex: 0 });
    render(<FloatingTabBar {...props} resolvedMode="light" />);
    await waitFor(() => expect(screen.getByText("Home")).toBeTruthy());
    expect(screen.getByText("Jobs")).toBeTruthy();

    const homeButton = screen.getByLabelText("Home");
    expect(homeButton.props.accessibilityState).toMatchObject({ selected: true });

    const jobsButton = screen.getByLabelText("Jobs");
    expect(jobsButton.props.accessibilityState).toMatchObject({ selected: false });
  });

  it("navigates to the tapped tab", async () => {
    const { props, navigate } = makeProps({ focusedIndex: 0 });
    render(<FloatingTabBar {...props} resolvedMode="light" />);
    await waitFor(() => expect(screen.getByLabelText("Jobs")).toBeTruthy());

    fireEvent.press(screen.getByLabelText("Jobs"));
    expect(navigate).toHaveBeenCalledWith("Jobs");
  });

  it("resolves light/dark colors from the design tokens", async () => {
    const light = makeProps({ focusedIndex: 0 });
    const { unmount } = render(<FloatingTabBar {...light.props} resolvedMode="light" />);
    await waitFor(() => screen.getByLabelText("Home"));
    expect(screen.getByLabelText("Home").props.style).toMatchObject({ backgroundColor: lightColors.infoBg });
    unmount();

    const dark = makeProps({ focusedIndex: 0 });
    render(<FloatingTabBar {...dark.props} resolvedMode="dark" />);
    await waitFor(() => screen.getByLabelText("Home"));
    expect(screen.getByLabelText("Home").props.style).toMatchObject({ backgroundColor: darkColors.infoBg });
  });
});
