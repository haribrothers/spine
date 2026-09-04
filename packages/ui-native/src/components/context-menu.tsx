import { MenuView, type MenuAction } from "@expo/ui/community/menu";

/**
 * `@expo/ui`'s community `MenuView` — real SwiftUI `Menu`/`ContextMenu` on
 * iOS, Jetpack Compose `DropdownMenu` on Android. Net-new component.
 *
 * Deliberately mirrors `@expo/ui`'s own flat `actions` array shape rather
 * than web `packages/ui`'s Radix compound-component tree (`ContextMenu`/
 * `ContextMenuTrigger`/`ContextMenuContent`/`ContextMenuItem`/
 * `ContextMenuCheckboxItem`/`ContextMenuRadioItem`) — `@expo/ui`'s native
 * menu (compatible with `@react-native-menu/menu`) has no compound-tree
 * equivalent to bridge into; building one would mean walking JSX children
 * at render time to reconstruct the actions array the native view actually
 * needs, adding real translation-layer fragility for no native benefit.
 * Native menu items are declared as data (`ContextMenuAction[]`), not JSX.
 *
 * A destructive item is `{ destructive: true }` (renders red text/icon,
 * matching web's `destructive` prop on `ContextMenuItem`); a checkbox-style
 * item is `{ state: "on" | "off" }` (renders a checkmark, no separate
 * `ContextMenuCheckboxItem`/`ContextMenuRadioItem` split — `@expo/ui`'s own
 * `MenuAction` type doesn't distinguish the two, both are just a
 * checked/unchecked action). Nested `subactions` render as a submenu (or an
 * inline section with `displayInline: true`), covering `ContextMenuSub`'s
 * role.
 */
export type ContextMenuAction = {
  id?: string;
  title: string;
  destructive?: boolean;
  disabled?: boolean;
  state?: "on" | "off";
  subactions?: ContextMenuAction[];
  displayInline?: boolean;
};

export interface ContextMenuProps {
  actions: ContextMenuAction[];
  onPressAction: (id: string) => void;
  shouldOpenOnLongPress?: boolean;
  children: React.ReactNode;
  testID?: string;
}

function toMenuActions(actions: ContextMenuAction[]): MenuAction[] {
  return actions.map((action) => ({
    id: action.id,
    title: action.title,
    state: action.state,
    subactions: action.subactions ? toMenuActions(action.subactions) : undefined,
    displayInline: action.displayInline,
    attributes: {
      destructive: action.destructive,
      disabled: action.disabled,
    },
  }));
}

export function ContextMenu({ actions, onPressAction, shouldOpenOnLongPress = true, children, testID }: ContextMenuProps) {
  return (
    <MenuView
      actions={toMenuActions(actions)}
      onPressAction={(event) => onPressAction(event.nativeEvent.event)}
      shouldOpenOnLongPress={shouldOpenOnLongPress}
      testID={testID}
    >
      {children}
    </MenuView>
  );
}
