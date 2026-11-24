import { AccessibilityInfo, Animated } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { GaugeIndicator } from "./components/gauge-indicator";
import { FloatingLabelField } from "./components/floating-label-field";
import { FloatingTabBar } from "./navigation/floating-tab-bar";

/**
 * US-OPS-09 — with Reduce Motion (iOS) or Remove animations (Android) on,
 * the gauge, the tab highlight and the floating label jump to their final
 * state: no spring, no timing, and the final state still shows.
 */
describe("US-OPS-09 · respect reduced-motion settings on the phone", () => {
  let spring: jest.SpyInstance;
  let timing: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    spring = jest.spyOn(Animated, "spring");
    timing = jest.spyOn(Animated, "timing");
  });
  afterEach(() => jest.restoreAllMocks());

  it("the gauge shows its final value at once, without a spring", async () => {
    render(<GaugeIndicator progress={0.76} trackColor="#cccccc" fillGradient={{ from: "#2954E5", to: "#2144BB" }} textColorClass="text-on-surface" />);
    await waitFor(() => expect(screen.getByText("76%")).toBeTruthy());
    expect(spring).not.toHaveBeenCalled();
  });

  it("the gauge still springs when motion is allowed", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    render(<GaugeIndicator progress={0.76} trackColor="#cccccc" fillGradient={{ from: "#2954E5", to: "#2144BB" }} textColorClass="text-on-surface" />);
    await waitFor(() => expect(spring).toHaveBeenCalled());
  });

  it("the tab highlight moves to the new tab without a spring", async () => {
    const props = (index: number) =>
      ({
        state: { index, routes: [{ key: "today", name: "Today" }, { key: "jobs", name: "Jobs" }] },
        descriptors: { today: { options: { title: "Today" } }, jobs: { options: { title: "Jobs" } } },
        navigation: { emit: () => ({ defaultPrevented: false }), navigate: jest.fn() },
        insets: { top: 0, bottom: 20, left: 0, right: 0 },
      }) as unknown as BottomTabBarProps;
    const view = render(<FloatingTabBar {...props(0)} resolvedMode="light" />);
    await act(async () => {});
    fireEvent(screen.getByLabelText("Today"), "layout", { nativeEvent: { layout: { x: 0, width: 100, y: 0, height: 49 } } });
    fireEvent(screen.getByLabelText("Jobs"), "layout", { nativeEvent: { layout: { x: 100, width: 100, y: 0, height: 49 } } });
    view.rerender(<FloatingTabBar {...props(1)} resolvedMode="light" />);
    expect(spring).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Jobs").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("the floating label moves up without animating, and is still shown", async () => {
    const view = render(<FloatingLabelField label="Description" value="" onChangeText={() => undefined} />);
    await act(async () => {});
    timing.mockClear();
    view.rerender(<FloatingLabelField label="Description" value="Tiles" onChangeText={() => undefined} />);
    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByText("Description")).toBeTruthy();
  });
});
