import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { ContextMenu } from "./context-menu";

/**
 * Unlike Button/Switch/Slider/Select, `@expo/ui`'s `MenuView` trigger
 * renders its `children` as an ORDINARY RN tree (confirmed live via
 * `screen.debug()`) — so `getByText` on the trigger content works exactly
 * like it would with any other RN component. Only the menu's own action
 * items are native-bridge nodes (`ViewManagerAdapter_ExpoUI` with `label`/
 * `onButtonPress`/`role` props), which still need the `findAll`-based
 * lookup pattern the other `@expo/ui`-backed components use.
 */
function findActionNodes(root: ReturnType<typeof render>) {
  const nodes = root.UNSAFE_root.findAll((n) => "onButtonPress" in n.props && (n.type as unknown) === "ViewManagerAdapter_ExpoUI");
  return [...new Set(nodes.map((n) => n.props.label))].map((label) => nodes.find((n) => n.props.label === label)!);
}

describe("ContextMenu a11y", () => {
  it("renders its trigger content as an ordinary, queryable element", () => {
    render(
      <ContextMenu actions={[{ id: "edit", title: "Edit" }]} onPressAction={() => {}}>
        <Text>Open menu</Text>
      </ContextMenu>,
    );
    expect(screen.getByText("Open menu")).toBeTruthy();
  });

  it("passes every action through with its label", () => {
    const root = render(
      <ContextMenu
        actions={[
          { id: "edit", title: "Edit" },
          { id: "delete", title: "Delete", destructive: true },
        ]}
        onPressAction={() => {}}
      >
        <Text>Open menu</Text>
      </ContextMenu>,
    );
    const labels = findActionNodes(root).map((n) => n.props.label);
    expect(labels).toEqual(["Edit", "Delete"]);
  });

  it("marks a destructive action with the native destructive role", () => {
    const root = render(
      <ContextMenu
        actions={[
          { id: "edit", title: "Edit" },
          { id: "delete", title: "Delete", destructive: true },
        ]}
        onPressAction={() => {}}
      >
        <Text>Open menu</Text>
      </ContextMenu>,
    );
    const [editNode, deleteNode] = findActionNodes(root);
    expect(editNode!.props.role).toBeUndefined();
    expect(deleteNode!.props.role).toBe("destructive");
  });

  it("wires each action's press through to onPressAction with its id", () => {
    const onPressAction = jest.fn();
    const root = render(
      <ContextMenu actions={[{ id: "edit", title: "Edit" }]} onPressAction={onPressAction}>
        <Text>Open menu</Text>
      </ContextMenu>,
    );
    const [editNode] = findActionNodes(root);
    (editNode!.props.onButtonPress as () => void)();
    expect(onPressAction).toHaveBeenCalledWith("edit");
  });
});
