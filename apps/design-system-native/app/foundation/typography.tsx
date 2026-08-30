import { Text, View } from "react-native";
import { typography, type TypographyToken } from "@spine/ui-native/tokens";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection } from "../../src/components/doc-page";

const ROWS: { token: TypographyToken; label: string }[] = [
  { token: "display", label: "Display" },
  { token: "h1", label: "H1" },
  { token: "h2", label: "H2" },
  { token: "h3", label: "H3" },
  { token: "bodyLg", label: "Body large" },
  { token: "bodyMd", label: "Body medium" },
  { token: "bodySm", label: "Body small" },
  { token: "label", label: "Label" },
  { token: "caption", label: "Caption" },
];

export function TypographyScreen() {
  return (
    <DocScreen>
      <DocTitle>Typography</DocTitle>
      <DocLead>
        Inter is the intended UI typeface, matching web — legible at the small sizes a dense line-item list or job
        card demands. IBM Plex Mono is reserved for money amounts and document numbers, so a changing number never
        visually reflows its neighbors once tabular figures are enabled.
      </DocLead>

      <DocSection title="Not yet wired up">
        <DocLead>
          packages/ui-native/src/tokens/typography.ts already names every token below with its intended
          Inter/Plex Mono family, but no app in this repo has loaded those fonts yet (no expo-font /
          @expo-google-fonts install exists today) — every screen currently renders in the OS default font. The
          sizes, weights, and line-heights below are real and already used by any component that reads these tokens;
          only the font family swap is outstanding.
        </DocLead>
      </DocSection>

      <DocSection title="Type scale">
        <View className="my-2 divide-y divide-border dark:divide-border-dark rounded-lg border border-border dark:border-border-dark">
          {ROWS.map((row) => {
            const t = typography[row.token];
            return (
              <View key={row.token} className="gap-1 p-4">
                <View className="flex-row items-baseline justify-between">
                  <Text className="text-[12px] font-medium text-on-surface dark:text-on-surface-dark">{row.label}</Text>
                  <Text className="font-mono text-[11px] text-on-surface-muted dark:text-on-surface-muted-dark">
                    {t.fontSize}px / {t.fontWeight}
                  </Text>
                </View>
                <Text style={{ fontSize: t.fontSize, fontWeight: t.fontWeight as never, lineHeight: t.lineHeight }}>
                  The quick brown fox
                </Text>
              </View>
            );
          })}
        </View>
      </DocSection>

      <DocSection title="Mono data">
        <DocLead>Intended for money amounts and document numbers, once IBM Plex Mono is loaded.</DocLead>
        <View className="my-2 gap-1 rounded-lg border border-border dark:border-border-dark p-4">
          <View className="flex-row justify-between">
            <Text className="font-mono text-[13px] text-on-surface dark:text-on-surface-dark">INV-2026-0042</Text>
            <Text className="font-mono text-[13px] text-on-surface dark:text-on-surface-dark">$1,240.00</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="font-mono text-[13px] text-on-surface dark:text-on-surface-dark">INV-2026-0043</Text>
            <Text className="font-mono text-[13px] text-on-surface dark:text-on-surface-dark">$89.50</Text>
          </View>
        </View>
      </DocSection>
    </DocScreen>
  );
}
