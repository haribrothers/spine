import { fireEvent, render, screen } from "@testing-library/react-native";
import { Stepper } from "./stepper";
import { expectAccessibilityState, expectAccessibleRole } from "../test/a11y";

/**
 * `Stepper` is the SAME plain RN implementation on both platforms (see its
 * own doc comment for why a real native SwiftUI Stepper was tried on iOS
 * and reverted in favor of one custom design matching Android's) — real RN
 * primitives throughout, so this uses the package's normal RNTL queries/
 * a11y helpers directly, with no platform split needed in these tests.
 */
describe("Stepper a11y", () => {
  it("shows the current value and exposes both buttons with real accessible roles/labels", () => {
    render(<Stepper value={5} onValueChange={() => {}} min={1} max={20} />);
    expect(screen.getByText("5")).toBeTruthy();
    const decrement = screen.getByLabelText("Decrease");
    const increment = screen.getByLabelText("Increase");
    expectAccessibleRole(decrement, "button");
    expectAccessibleRole(increment, "button");
  });

  it("increments/decrements by step and clamps onValueChange calls within min/max", () => {
    const onValueChange = jest.fn();
    render(<Stepper value={5} onValueChange={onValueChange} min={1} max={20} step={2} />);
    fireEvent.press(screen.getByLabelText("Increase"));
    expect(onValueChange).toHaveBeenCalledWith(7);
    fireEvent.press(screen.getByLabelText("Decrease"));
    expect(onValueChange).toHaveBeenCalledWith(3);
  });

  it("disables the decrement button at min and does not call onValueChange when pressed", () => {
    const onValueChange = jest.fn();
    render(<Stepper value={1} onValueChange={onValueChange} min={1} max={20} />);
    const decrement = screen.getByLabelText("Decrease");
    expectAccessibilityState(decrement, { disabled: true });
    fireEvent.press(decrement);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("disables the increment button at max and does not call onValueChange when pressed", () => {
    const onValueChange = jest.fn();
    render(<Stepper value={20} onValueChange={onValueChange} min={1} max={20} />);
    const increment = screen.getByLabelText("Increase");
    expectAccessibilityState(increment, { disabled: true });
    fireEvent.press(increment);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("disables both buttons when the disabled prop is set, regardless of value", () => {
    render(<Stepper value={5} onValueChange={() => {}} min={1} max={20} disabled />);
    expectAccessibilityState(screen.getByLabelText("Decrease"), { disabled: true });
    expectAccessibilityState(screen.getByLabelText("Increase"), { disabled: true });
  });

  it("defaults min/max/step to 0/100/1 when omitted", () => {
    const onValueChange = jest.fn();
    render(<Stepper value={5} onValueChange={onValueChange} />);
    fireEvent.press(screen.getByLabelText("Increase"));
    expect(onValueChange).toHaveBeenCalledWith(6);
  });
});
