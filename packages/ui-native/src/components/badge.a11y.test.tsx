import { render, screen } from "@testing-library/react-native";
import { Badge } from "./badge";

describe("Badge a11y", () => {
  it("renders its visible text so a screen reader has something to announce", () => {
    render(<Badge>3 overdue</Badge>);
    expect(screen.getByText("3 overdue")).toBeTruthy();
  });
});
