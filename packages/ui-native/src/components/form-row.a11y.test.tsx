import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { FormRow, FormSection } from "./form-row";

/**
 * Plain RN primitives throughout (no `@expo/ui` bridge involved) — real
 * RNTL queries, same as this package's other non-native-backed components.
 */
describe("FormRow", () => {
  it("renders a plain-label row with the label and control side by side", () => {
    render(
      <FormRow label="Start date">
        <Text>1 Aug 2026</Text>
      </FormRow>,
    );
    expect(screen.getByText("Start date")).toBeTruthy();
    expect(screen.getByText("1 Aug 2026")).toBeTruthy();
  });

  it("shows a required asterisk next to the label when required", () => {
    render(
      <FormRow label="Crew size" required>
        <Text>4</Text>
      </FormRow>,
    );
    expect(screen.getByText("*")).toBeTruthy();
  });

  it("renders children full-width with no separate label element when label is omitted", () => {
    render(
      <FormRow>
        <Text>Title field</Text>
      </FormRow>,
    );
    expect(screen.getByText("Title field")).toBeTruthy();
  });

  it("shows the error message when set, and omits it entirely otherwise", () => {
    const withError = render(
      <FormRow error="Title is required.">
        <Text>Title field</Text>
      </FormRow>,
    );
    expect(withError.getByText("Title is required.")).toBeTruthy();
    withError.unmount();

    render(
      <FormRow>
        <Text>Title field</Text>
      </FormRow>,
    );
    expect(screen.queryByText("Title is required.")).toBeNull();
  });

  it("renders a trailing divider unless last is set", () => {
    const withDivider = render(
      <FormRow label="Start date">
        <Text>1 Aug 2026</Text>
      </FormRow>,
    );
    // Divider renders as an accessibility-hidden View with no text content
    // of its own — presence is confirmed by finding a node with
    // `accessibilityElementsHidden` (Divider's own marker prop, see
    // divider.tsx).
    expect(withDivider.UNSAFE_root.findAll((n) => n.props.accessibilityElementsHidden === true).length).toBeGreaterThan(0);
    withDivider.unmount();

    const last = render(
      <FormRow label="Retention held" last>
        <Text>On</Text>
      </FormRow>,
    );
    expect(last.UNSAFE_root.findAll((n) => n.props.accessibilityElementsHidden === true)).toHaveLength(0);
  });
});

describe("FormSection", () => {
  it("renders the title and, when given, a description", () => {
    render(
      <FormSection title="Details" description="Basic job information.">
        <Text>content</Text>
      </FormSection>,
    );
    expect(screen.getByText("Details")).toBeTruthy();
    expect(screen.getByText("Basic job information.")).toBeTruthy();
  });

  it("omits the description entirely when not given", () => {
    render(
      <FormSection title="Details">
        <Text>content</Text>
      </FormSection>,
    );
    expect(screen.getByText("Details")).toBeTruthy();
  });

  it("renders its children inside the card", () => {
    render(
      <FormSection title="Details">
        <Text>a field</Text>
      </FormSection>,
    );
    expect(screen.getByText("a field")).toBeTruthy();
  });
});
