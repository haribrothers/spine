import { act, render, screen } from "@testing-library/react-native";
import { GaugeIndicator } from "./gauge-indicator";

/**
 * `GaugeIndicator` animates its own fill via `Animated.spring` on mount
 * (see the component's own doc comment for why `useNativeDriver: false` is
 * required) — fake timers let each test advance past the spring settling
 * so the displayed percentage reflects the FINAL value, not an in-flight
 * mid-animation one.
 */
jest.useFakeTimers();

function renderSettled(progress: number) {
  const root = render(
    <GaugeIndicator progress={progress} trackColor="#cccccc" fillGradient={{ from: "#2954E5", to: "#2144BB" }} textColorClass="text-on-surface" />,
  );
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  return root;
}

describe("GaugeIndicator a11y", () => {
  it("shows the rounded percentage once the sweep-in animation settles", () => {
    renderSettled(0.76);
    expect(screen.getByText("76%")).toBeTruthy();
  });

  it("clamps a progress value above 1 to 100%", () => {
    renderSettled(1.5);
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("clamps a negative progress value to 0%", () => {
    renderSettled(-0.5);
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("applies the given textColorClass to the percentage text", () => {
    render(
      <GaugeIndicator progress={0.5} trackColor="#cccccc" fillGradient={{ from: "#2954E5", to: "#2144BB" }} textColorClass="text-overdue dark:text-overdue-dark" />,
    );
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText("50%").props.className).toContain("text-overdue");
  });
});
