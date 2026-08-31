import { render, screen } from "@testing-library/react-native";
import { Avatar } from "./avatar";

describe("Avatar a11y", () => {
  it.each(["sm", "md", "lg"] as const)(
    "renders its fallback text so a screen reader has something to announce (%s)",
    (size) => {
      render(<Avatar size={size} fallback="JD" />);
      expect(screen.getByText("JD")).toBeTruthy();
    },
  );
});
