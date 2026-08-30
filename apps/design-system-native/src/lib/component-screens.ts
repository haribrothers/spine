import { ButtonScreen } from "../../app/components/button";
import { TextFieldScreen } from "../../app/components/text-field";
import { CardScreen } from "../../app/components/card";
import { BadgeScreen } from "../../app/components/badge";
import { TabBarScreen } from "../../app/components/tab-bar";
import { FloatingTabBarScreen } from "../../app/components/floating-tab-bar";

/**
 * Maps each component-registry slug to its doc screen — shared by both the
 * mobile stack (component-detail.tsx) and the desktop content pane
 * (desktop-shell.tsx), so there's exactly one place to register a new
 * component's screen. Keep in sync with component-registry.ts.
 */
export const COMPONENT_SCREENS: Record<string, React.ComponentType> = {
  button: ButtonScreen,
  "text-field": TextFieldScreen,
  card: CardScreen,
  badge: BadgeScreen,
  "tab-bar": TabBarScreen,
  "floating-tab-bar": FloatingTabBarScreen,
};
