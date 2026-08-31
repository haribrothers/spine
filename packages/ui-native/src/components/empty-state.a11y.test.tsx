import { render, screen } from "@testing-library/react-native";
import Inbox from "lucide-react-native/icons/inbox";
import { EmptyState } from "./empty-state";
import { Button } from "./button";
import { expectAccessibleRole } from "../test/a11y";

describe("EmptyState a11y", () => {
  it("has an accessible header carrying the title, with icon/description/action present", () => {
    render(
      <EmptyState
        icon={<Inbox size={24} />}
        title="No invoices yet"
        description="Invoices you issue will show up here."
        action={<Button onPress={() => {}}>New invoice</Button>}
      />,
    );
    const header = screen.getByRole("header");
    expectAccessibleRole(header, "header");
    expect(screen.getByText("Invoices you issue will show up here.")).toBeTruthy();
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("renders with just a title — icon, description, and action are all optional", () => {
    render(<EmptyState title="No jobs found" />);
    expect(screen.getByRole("header")).toBeTruthy();
    expect(screen.getByText("No jobs found")).toBeTruthy();
  });
});
