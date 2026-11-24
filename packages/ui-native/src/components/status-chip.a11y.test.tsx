import { render, screen } from "@testing-library/react-native";
import { StatusChip } from "./status-chip";

describe("StatusChip a11y", () => {
  it.each(["paid", "due-soon", "overdue", "draft"] as const)(
    "renders its visible text so a screen reader has something to announce (%s)",
    (status) => {
      render(<StatusChip status={status}>{status}</StatusChip>);
      expect(screen.getByText(status)).toBeTruthy();
    },
  );
});
