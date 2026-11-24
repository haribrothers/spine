import { render, screen } from "@testing-library/react-native";
import { Spinner } from "./spinner";

describe("Spinner a11y", () => {
  it.each(["sm", "md", "lg"] as const)("announces a default 'Loading' label (%s)", (size) => {
    render(<Spinner size={size} />);
    expect(screen.getByLabelText("Loading")).toBeTruthy();
  });

  it("accepts a custom label for a polite announcement more specific than 'Loading'", () => {
    render(<Spinner label="Issuing invoice…" />);
    expect(screen.getByLabelText("Issuing invoice…")).toBeTruthy();
  });
});
