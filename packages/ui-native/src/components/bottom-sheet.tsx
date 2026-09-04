import { BottomSheet as ExpoBottomSheet, Host, type SnapPoint } from "@expo/ui";
import { useNativeColors } from "../theme/use-native-colors";

/**
 * `@expo/ui`'s universal `BottomSheet` — genuinely cross-platform (iOS,
 * Android, AND web, ships in Expo Go, unlike the SwiftUI/Compose-subpath
 * components), real native modal-sheet chrome on every platform. Net-new
 * component.
 *
 * Themed content inside the sheet uses ordinary `packages/ui-native`
 * components; the sheet's own chrome (backdrop, drag indicator, corner
 * radius) IS directly themeable here — `containerColor` (the sheet's own
 * background) and `scrimColor` (Android backdrop) are real props on
 * `@expo/ui`'s component, resolved from the design system's `surface`/
 * `onSurface`-derived tokens below, not left at each platform's own
 * default. `contentColor` (Android-only, for native Compose content that
 * isn't RN) has no bearing on this sheet's `children`, which are always RN
 * views — see `@expo/ui`'s own doc comment on that prop.
 */
export interface BottomSheetProps {
  isPresented: boolean;
  onDismiss: () => void;
  children?: React.ReactNode;
  showDragIndicator?: boolean;
  snapPoints?: SnapPoint[];
  testID?: string;
}

export function BottomSheet({ isPresented, onDismiss, children, showDragIndicator = true, snapPoints, testID }: BottomSheetProps) {
  const colors = useNativeColors();

  return (
    <Host matchContents>
      <ExpoBottomSheet
        isPresented={isPresented}
        onDismiss={onDismiss}
        showDragIndicator={showDragIndicator}
        snapPoints={snapPoints}
        containerColor={colors.surface}
        scrimColor={`${colors.onSurface}80`}
        testID={testID}
      >
        {children}
      </ExpoBottomSheet>
    </Host>
  );
}
