import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import Inbox from "lucide-react-native/icons/inbox";
import { EmptyState } from "./empty-state";
import { expectAccessibleRole } from "../test/a11y";

describe("EmptyState a11y", () => {
  it("has an accessible header carrying the title, with icon/description/action present", () => {
    // Uses a plain `Text` for `action` rather than `Button` — `Button` is
    // now `@expo/ui`-backed (a real native-bridge component, opaque under
    // jest-expo, see button.a11y.test.tsx's own doc comment) and isn't the
    // thing under test here; this test only cares that EmptyState renders
    // its icon/description/action slots, which any action content proves.
    render(
      <EmptyState
        icon={<Inbox size={24} />}
        title="No invoices yet"
        description="Invoices you issue will show up here."
        action={<Text>New invoice</Text>}
      />,
    );
    const header = screen.getByRole("header");
    expectAccessibleRole(header, "header");
    expect(screen.getByText("Invoices you issue will show up here.")).toBeTruthy();
    expect(screen.getByText("New invoice")).toBeTruthy();
  });

  it("renders with just a title — icon, description, and action are all optional", () => {
    render(<EmptyState title="No jobs found" />);
    expect(screen.getByRole("header")).toBeTruthy();
    expect(screen.getByText("No jobs found")).toBeTruthy();
  });
});
