import { Slider as ExpoSlider, Host } from "@expo/ui";
import { useNativeHostTheme } from "../theme/use-native-colors";

/**
 * `@expo/ui`'s universal `Slider` — real SwiftUI `Slider`/Jetpack Compose
 * `Slider` via a `Host` bridge. Net-new component.
 *
 * Single-thumb only, a deliberate narrowing from web `packages/ui`'s
 * Slider (which supports N thumbs via an array `value`, e.g. a range
 * slider) — confirmed against `@expo/ui`'s real TS type, whose `value` is a
 * plain `number`, matching both SwiftUI's and Jetpack Compose's own native
 * `Slider` controls, neither of which has a multi-thumb variant. A future
 * range-slider need has no native-first path here and would need its own,
 * separately-scoped decision (e.g. a NativeWind-styled custom control)
 * rather than stretching this component to fake it.
 */
export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  testID?: string;
}

export function Slider({ value, onValueChange, min = 0, max = 1, step, disabled = false, testID }: SliderProps) {
  const hostTheme = useNativeHostTheme();

  return (
    <Host matchContents colorScheme={hostTheme.colorScheme} seedColor={hostTheme.seedColor}>
      <ExpoSlider value={value} onValueChange={onValueChange} min={min} max={max} step={step} disabled={disabled} testID={testID} />
    </Host>
  );
}
