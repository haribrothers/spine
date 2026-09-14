import { fireEvent, render, screen } from "@testing-library/react-native";
import FileText from "lucide-react-native/icons/file-text";
import { ActionTile } from "./action-tile";
import { expectAccessibilityState, expectAccessibleRole } from "../test/a11y";

describe("ActionTile a11y", () => {
  it("exposes a real button role with the label as its accessible name", () => {
    render(<ActionTile label="New quote" icon={FileText} onPress={() => {}} iconColor="#2954E5" />);
    const tile = screen.getByRole("button");
    expectAccessibleRole(tile, "button");
    expect(screen.getByText("New quote")).toBeTruthy();
  });

  it("wires onPress through to a real press", () => {
    const onPress = jest.fn();
    render(<ActionTile label="New quote" icon={FileText} onPress={onPress} iconColor="#2954E5" />);
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("reports disabled via accessibilityState and does not fire onPress when pressed", () => {
    const onPress = jest.fn();
    render(<ActionTile label="New quote" icon={FileText} onPress={onPress} iconColor="#2954E5" disabled />);
    const tile = screen.getByRole("button");
    expectAccessibilityState(tile, { disabled: true });
    fireEvent.press(tile);
    expect(onPress).not.toHaveBeenCalled();
  });
});
