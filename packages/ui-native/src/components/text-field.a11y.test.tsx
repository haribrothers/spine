import { render, screen } from "@testing-library/react-native";
import { TextField } from "./text-field";

describe("TextField a11y", () => {
  it("is editable and enabled by default", () => {
    render(<TextField accessibilityLabel="Job name" testID="job-name" />);
    const field = screen.getByTestId("job-name");
    expect(field.props.accessibilityState?.disabled).toBeFalsy();
    expect(field.props.editable).not.toBe(false);
  });

  it("reports disabled via accessibilityState when not editable", () => {
    render(<TextField accessibilityLabel="Job name" testID="job-name" editable={false} />);
    const field = screen.getByTestId("job-name");
    expect(field.props.accessibilityState?.disabled).toBe(true);
  });

  it("accepts an accessibilityLabel distinct from its placeholder", () => {
    render(<TextField accessibilityLabel="Job name" placeholder="e.g. Kitchen renovation" testID="job-name" />);
    const field = screen.getByTestId("job-name");
    expect(field.props.accessibilityLabel).toBe("Job name");
  });
});
