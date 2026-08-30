import { useWindowDimensions } from "react-native";

/**
 * Width-based, not Platform.OS-based: a narrow browser window gets the same
 * mobile (list -> stack-push detail) layout a phone gets, matching how a
 * responsive web page behaves, per the design-system-native layout decision
 * (mirror apps/design-system's chrome on wide viewports; mobile layout
 * everywhere else, including a narrowed desktop browser).
 */
const DESKTOP_BREAKPOINT = 768;

export function useIsDesktopLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}
