import { fireEvent, render, screen } from "@testing-library/react-native";
import { OutlinedFrame, OutlinedTextField } from "./outlined-text-field";

describe("OutlinedTextField a11y", () => {
  it("names the input by its label and shows the placeholder", () => {
    render(<OutlinedTextField label="Caption" placeholder="What does this photo show?" value="" onChangeText={() => {}} testID="caption" />);
    const input = screen.getByTestId("caption");
    expect(input.props.accessibilityLabel).toBe("Caption");
    expect(input.props.placeholder).toBe("What does this photo show?");
    expect(screen.getByText("Caption")).toBeTruthy();
  });

  it("passes typing through", () => {
    const onChangeText = jest.fn();
    render(<OutlinedTextField label="Caption" value="" onChangeText={onChangeText} testID="caption" />);
    fireEvent.changeText(screen.getByTestId("caption"), "Cabinets in");
    expect(onChangeText).toHaveBeenCalledWith("Cabinets in");
  });

  it("reads the error to a screen reader and shows it in text, not only colour", () => {
    render(<OutlinedTextField label="Amount (USD)" prefix="$" value="" onChangeText={() => {}} error helperText="Enter an amount." testID="amount" />);
    expect(screen.getByTestId("amount").props.accessibilityHint).toBe("Enter an amount.");
    expect(screen.getByText("Enter an amount.")).toBeTruthy();
    expect(screen.getByText("$")).toBeTruthy();
  });

  it("lets the outline wrap any content", () => {
    render(
      <OutlinedFrame label="Date" testID="frame">
        <></>
      </OutlinedFrame>,
    );
    expect(screen.getByText("Date")).toBeTruthy();
  });
});
