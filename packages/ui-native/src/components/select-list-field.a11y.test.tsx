import { act, fireEvent, render, screen, type RenderAPI } from "@testing-library/react-native";
import { FlatList } from "react-native";
import { SelectListField } from "./select-list-field";

/**
 * `BottomSheet`'s own a11y-test precedent (`bottom-sheet.a11y.test.tsx`)
 * notes its `@expo/ui` jest mock renders `children` regardless of
 * `isPresented` — so when the selected option's label matches the closed
 * trigger's own text (e.g. "Coastal Renovations" showing both as the
 * trigger's current value AND as a sheet-content row), `getByText` matches
 * both. Each option row carries its own `testID` (`${testID}-option-
 * ${value}`) specifically so tests can address a row unambiguously.
 *
 * **`fireEvent.press` on a row inside the sheet is a confirmed no-op under
 * test — this is a real gap in `BottomSheet`'s own jest mock, not a bug in
 * this component.** `BottomSheet` wraps its `children` in `RNHostView
 * matchContents` (see `bottom-sheet.tsx`'s own doc comment on why that
 * wrapper exists) — `jest-expo`'s mock of that native-bridge view does not
 * propagate RN's real touch-responder system through to content rendered
 * inside it, confirmed by reproducing the same failure with a bare
 * `FlatList`/`Pressable` (no `SelectListField` involved at all) nested
 * inside a real `BottomSheet` in isolation. This matches CLAUDE.md's own
 * documented pattern for `@expo/ui`-backed components: assert against the
 * PROPS passed into the native-bridge subtree rather than simulating a
 * full interaction through it. `findOptionRowOnPress` below reads a row's
 * `onPress` prop directly off the query result and invokes it as a plain
 * function call — this still exercises `SelectListField`'s own
 * `handleSelect` logic (the thing actually under test), it just doesn't
 * route through RNTL's synthetic touch-event dispatch, which the mock
 * can't carry through `RNHostView` regardless.
 *
 * `screen.getByTestId` resolves to the innermost HOST `View` a `Pressable`
 * renders, which carries no `onPress` of its own (`Pressability` consumes
 * it internally and exposes responder props instead) — the composite
 * `Pressable` element itself, one level up, is where the real `onPress`
 * function lives, found here via `UNSAFE_root.findAllByProps` filtered to
 * the entry whose `onPress` is actually a function.
 */
function findOptionRowOnPress(root: RenderAPI, testID: string): () => void {
  const matches = root.UNSAFE_root.findAllByProps({ testID });
  const pressableNode = matches.find((node) => typeof node.props.onPress === "function")!;
  return pressableNode.props.onPress as () => void;
}

const OPTIONS = [
  { label: "Acme Contracting Ltd.", value: "acme" },
  { label: "Bright Homes", value: "bright" },
  { label: "Coastal Renovations", value: "coastal" },
];

describe("SelectListField a11y", () => {
  it("shows the selected option's label on the closed trigger", () => {
    render(<SelectListField options={OPTIONS} value="bright" onValueChange={() => {}} testID="client-select" />);
    expect(screen.getByText("Bright Homes")).toBeTruthy();
  });

  it("shows the placeholder when no value is selected", () => {
    render(<SelectListField options={OPTIONS} value={null} onValueChange={() => {}} placeholder="Select client" testID="client-select" />);
    expect(screen.getByText("Select client")).toBeTruthy();
  });

  it("exposes the trigger as a button with its disabled state", () => {
    render(<SelectListField options={OPTIONS} value={null} onValueChange={() => {}} disabled testID="client-select" />);
    const trigger = screen.getByTestId("client-select");
    expect(trigger.props.accessibilityRole).toBe("button");
    expect(trigger.props.accessibilityState?.disabled).toBe(true);
  });

  it("opens the sheet and filters options by search query", () => {
    render(<SelectListField options={OPTIONS} value={null} onValueChange={() => {}} testID="client-select" />);
    fireEvent.press(screen.getByTestId("client-select"));
    expect(screen.getByText("Acme Contracting Ltd.")).toBeTruthy();
    expect(screen.getByText("Coastal Renovations")).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText("Search…"), "bright");
    expect(screen.getByText("Bright Homes")).toBeTruthy();
    expect(screen.queryByText("Acme Contracting Ltd.")).toBeNull();
  });

  it("marks the selected option row for assistive technology", () => {
    render(<SelectListField options={OPTIONS} value="coastal" onValueChange={() => {}} testID="client-select" />);
    fireEvent.press(screen.getByTestId("client-select"));
    const row = screen.getByTestId("client-select-option-coastal");
    expect(row.props.accessibilityState?.selected).toBe(true);
  });

  it("calls onValueChange with the picked option's value and closes the sheet", () => {
    const onValueChange = jest.fn();
    const root = render(<SelectListField options={OPTIONS} value={null} onValueChange={onValueChange} testID="client-select" />);
    fireEvent.press(screen.getByTestId("client-select"));
    act(() => findOptionRowOnPress(root, "client-select-option-acme")());
    expect(onValueChange).toHaveBeenCalledWith("acme");
  });

  it("floatingLabel: renders as the placeholder text when nothing is selected", () => {
    render(<SelectListField options={OPTIONS} value={null} onValueChange={() => {}} floatingLabel="Client" testID="client-select" />);
    expect(screen.getByText("Client")).toBeTruthy();
  });

  it("floatingLabel: floats above the selected option's label once a value is selected, with the asterisk when required", () => {
    render(<SelectListField options={OPTIONS} value="bright" onValueChange={() => {}} floatingLabel="Client" required testID="client-select" />);
    expect(screen.getByText("Client *")).toBeTruthy();
    expect(screen.getAllByText("Bright Homes").length).toBeGreaterThan(0);
  });

  // A real, reported bug: reopening the sheet after picking a far-down
  // option (e.g. the 50th of 120) showed the list scrolled back to the
  // top, with no indication of where the current selection was without
  // scrolling down again. Fixed via `initialScrollIndex`, set to the
  // selected option's index in the (unfiltered) `options` list at the
  // moment the sheet opens.
  function findList(root: RenderAPI) {
    return root.UNSAFE_root.findByType(FlatList);
  }

  it("opens scrolled to the selected option's index, not always the top", () => {
    const root = render(<SelectListField options={OPTIONS} value="coastal" onValueChange={() => {}} testID="client-select" />);
    fireEvent.press(screen.getByTestId("client-select"));
    expect(findList(root).props.initialScrollIndex).toBe(OPTIONS.findIndex((o) => o.value === "coastal"));
  });

  it("opens with no initialScrollIndex when nothing is selected yet", () => {
    const root = render(<SelectListField options={OPTIONS} value={null} onValueChange={() => {}} testID="client-select" />);
    fireEvent.press(screen.getByTestId("client-select"));
    expect(findList(root).props.initialScrollIndex).toBeUndefined();
  });
});
