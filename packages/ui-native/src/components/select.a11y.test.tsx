import { render } from "@testing-library/react-native";
import { Select } from "./select";

const STATUS_OPTIONS = [
  { label: "Scheduled", value: "scheduled" },
  { label: "In progress", value: "in_progress" },
  { label: "Complete", value: "complete" },
];

/**
 * `Picker` is a native host component (RNCPicker) — its `Picker.Item`
 * children are consumed and re-derived into an `items` prop array on the
 * rendered native host node, not preserved as traversable child elements
 * (confirmed by dumping the actual render tree via `toJSON()` while
 * building this test). The first assertion checks that host node's
 * `items` directly rather than `getByText`, which finds nothing since
 * there's no `Text` node in the tree at all. `enabled={false}` doesn't
 * surface as a prop on the mocked host node in this test environment
 * (also confirmed by dumping the tree) — the second test instead asserts
 * the real, actually-rendered signal: the wrapping View's `opacity-50`
 * className.
 */
describe("Select a11y", () => {
  it("passes every option through to the underlying native picker", () => {
    const { toJSON } = render(<Select options={STATUS_OPTIONS} value="in_progress" onValueChange={() => {}} />);
    const picker = findByType(toJSON(), "RNCPicker");
    const items = picker?.props.items as { label: string }[];
    expect(items.map((item) => item.label)).toEqual(["Scheduled", "In progress", "Complete"]);
  });

  it("visually reflects a disabled state on its wrapping container", () => {
    const { toJSON } = render(
      <Select options={STATUS_OPTIONS} value="complete" onValueChange={() => {}} enabled={false} />,
    );
    const root = toJSON();
    const node = Array.isArray(root) ? root[0] : root;
    expect(String(node?.props.className)).toContain("opacity-50");
  });
});

interface JsonNode {
  type: string;
  props: Record<string, unknown>;
  children: (JsonNode | string)[] | null;
}

function findByType(node: JsonNode | JsonNode[] | null, type: string): JsonNode | null {
  if (!node) return null;
  const nodes = Array.isArray(node) ? node : [node];
  for (const n of nodes) {
    if (n.type === type) return n;
    if (n.children) {
      const found = findByType(n.children.filter((c): c is JsonNode => typeof c !== "string"), type);
      if (found) return found;
    }
  }
  return null;
}
