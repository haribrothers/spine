import { ActivityIndicator, Platform, Pressable, Text } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useNativeColors } from "@spine/ui-native";

type Icon = React.ComponentType<{ size?: number; color?: string }>;

/**
 * The tinted pill on job cards and rows ("Call Alan Reyes", "Directions",
 * "Present"): primary text on the info tint on iOS, Material 3's tonal
 * button (primary-container) on Android (US-MOB-20); `outlined` is
 * Android's secondary pill, `neutral` iOS's grey one (Android: outlined).
 * At least 44pt tall. `working` keeps it pressed-down with its label
 * ("Reading…") and a spinner — none with Reduce Motion — and `disabled`
 * dims it; both tell screen readers (US-AI-10).
 */
export function PillButton({
  label,
  icon: Icon,
  onPress,
  outlined = false,
  neutral = false,
  disabled = false,
  working = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
  grow = false,
}: {
  label: string;
  icon?: Icon;
  onPress: () => void;
  outlined?: boolean;
  neutral?: boolean;
  disabled?: boolean;
  working?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  grow?: boolean;
}) {
  const colors = useNativeColors();
  const reducedMotion = useReducedMotion();
  const android = Platform.OS === "android";
  const bordered = outlined || (neutral && android);
  const grey = neutral && !android;
  const tonal = !bordered && !grey && android;
  const ink = tonal ? colors.onPrimaryContainer : grey ? colors.onSurface : colors.primary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || working}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || working, busy: working }}
      style={disabled ? { opacity: 0.4 } : undefined}
      className={`min-h-[44px] flex-row items-center justify-center gap-2 rounded-full px-4 active:opacity-70 ${
        bordered
          ? "border border-border-strong dark:border-border-strong-dark"
          : grey
            ? "bg-neutral-200 dark:bg-neutral-200-dark"
            : tonal
              ? "bg-primary-container dark:bg-primary-container-dark"
              : "bg-info-bg dark:bg-info-bg-dark"
      } ${grow ? "flex-1" : ""}`}
    >
      {working ? (
        reducedMotion ? null : (
          <ActivityIndicator size="small" color={ink} accessibilityElementsHidden importantForAccessibility="no" />
        )
      ) : Icon ? (
        <Icon size={18} color={ink} />
      ) : null}
      <Text
        numberOfLines={1}
        className={`text-[15px] font-semibold ${tonal ? "text-on-primary-container dark:text-on-primary-container-dark" : grey ? "text-on-surface dark:text-on-surface-dark" : "text-primary dark:text-primary-dark"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
