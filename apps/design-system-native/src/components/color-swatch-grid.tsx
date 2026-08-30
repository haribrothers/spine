import { Text, View } from "react-native";
import { darkColors, lightColors, type ColorToken } from "@spine/ui-native/tokens";
import { useTheme } from "@spine/ui-native";

export interface ColorSwatch {
  name: string;
  token: ColorToken;
}

/**
 * RN port of apps/design-system's ColorSwatchGrid — reads live values from
 * @spine/ui-native's own lightColors/darkColors (not a copy), so a swatch
 * always reflects the actual token, and switches with the app's own theme
 * toggle exactly like web's CSS-custom-property version does.
 */
export function ColorSwatchGrid({ swatches }: { swatches: ColorSwatch[] }) {
  const { resolvedMode } = useTheme();
  const colors = resolvedMode === "dark" ? darkColors : lightColors;

  return (
    <View className="my-2 flex-row flex-wrap gap-3">
      {swatches.map((swatch) => (
        <View key={swatch.token} className="w-[104px] gap-1.5">
          <View
            style={{ backgroundColor: colors[swatch.token] }}
            className="h-14 rounded-lg border border-border dark:border-border-dark"
          />
          <Text className="text-[12px] font-medium text-on-surface dark:text-on-surface-dark">{swatch.name}</Text>
          <Text className="font-mono text-[11px] text-on-surface-muted dark:text-on-surface-muted-dark">
            {colors[swatch.token]}
          </Text>
        </View>
      ))}
    </View>
  );
}
