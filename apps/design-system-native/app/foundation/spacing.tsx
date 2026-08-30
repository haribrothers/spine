import { Text, View } from "react-native";
import { spacing } from "@spine/ui-native/tokens";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection } from "../../src/components/doc-page";

const SCALE: { name: keyof typeof spacing; label: string }[] = [
  { name: "xs", label: "xs" },
  { name: "sm", label: "sm" },
  { name: "md", label: "md" },
  { name: "lg", label: "lg" },
  { name: "xl", label: "xl" },
  { name: "2xl", label: "2xl" },
];

export function SpacingScreen() {
  return (
    <DocScreen>
      <DocTitle>Spacing</DocTitle>
      <DocLead>
        A 12px spacing scale (with a 4px half-step for icon-to-label gaps) governs all spacing across
        @spine/ui-native, matching web&apos;s @spine/ui scale exactly — see
        packages/ui-native/src/tokens/spacing.ts.
      </DocLead>

      <DocSection title="Scale">
        <View className="my-2 gap-3">
          {SCALE.map((step) => (
            <View key={step.name} className="flex-row items-center gap-4">
              <Text className="w-12 font-mono text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">{step.label}</Text>
              <Text className="w-12 font-mono text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">
                {spacing[step.name]}px
              </Text>
              <View className="h-4 rounded-sm bg-primary dark:bg-primary-dark" style={{ width: spacing[step.name] }} />
            </View>
          ))}
        </View>
      </DocSection>

      <DocSection title="Touch target">
        <DocLead>
          Every interactive control in @spine/ui-native uses a minimum 44×44pt touch target — a field user on
          apps/mobile is frequently one-handed, sometimes gloved, on a job site. Unlike web (where this is a
          mobile-only footnote and desktop forms stay 40px), this is the library-wide default here: Button&apos;s default
          size and every touch-surface Checkbox/RadioGroup/Switch already meet it via padding.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
