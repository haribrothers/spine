import { Text, View } from "react-native";
import Search from "lucide-react-native/icons/search";
import Sun from "lucide-react-native/icons/sun";
import House from "lucide-react-native/icons/house";
import Briefcase from "lucide-react-native/icons/briefcase";
import DollarSign from "lucide-react-native/icons/dollar-sign";
import Component from "lucide-react-native/icons/component";
import Palette from "lucide-react-native/icons/palette";
import Compass from "lucide-react-native/icons/compass";
import { darkColors, lightColors } from "@spine/ui-native/tokens";
import { useTheme } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection } from "../../src/components/doc-page";

const COMMON_ICONS = [
  { Icon: Compass, name: "Compass" },
  { Icon: Palette, name: "Palette" },
  { Icon: Component, name: "Component" },
  { Icon: House, name: "House" },
  { Icon: Briefcase, name: "Briefcase" },
  { Icon: DollarSign, name: "DollarSign" },
  { Icon: Search, name: "Search" },
  { Icon: Sun, name: "Sun" },
];

export function IconsScreen() {
  const { resolvedMode } = useTheme();
  const iconColor = resolvedMode === "dark" ? darkColors.onSurface : lightColors.onSurface;

  return (
    <DocScreen>
      <DocTitle>Icons</DocTitle>
      <DocLead>
        lucide-react-native is the single icon set on the native side, matching web&apos;s lucide-react — the same
        icon language on both platforms. Every icon is imported via its own per-icon subpath (e.g.
        lucide-react-native/icons/house), never the bare package barrel import, which pulls in all ~1,900 icons
        regardless of which few are used.
      </DocLead>

      <DocSection title="Sizes actually used today">
        <DocLead>
          Unlike web, there&apos;s no single documented icon-size scale yet — sizes are chosen per call site. These
          are the sizes in use across this app and apps/mobile today:
        </DocLead>
        <View className="my-4 flex-row flex-wrap items-end gap-6">
          {[
            { size: 14, label: "14pt — desktop top bar search icon" },
            { size: 18, label: "18pt — header icons (search, theme toggle)" },
            { size: 24, label: "24pt — FloatingTabBar icons (TAB_ICON_SIZE)" },
          ].map((entry) => (
            <View key={entry.size} className="items-center gap-2">
              <Search size={entry.size} color={iconColor} />
              <Text className="max-w-24 text-center text-[11px] text-on-surface-muted dark:text-on-surface-muted-dark">
                {entry.label}
              </Text>
            </View>
          ))}
        </View>
      </DocSection>

      <DocSection title="Stroke width">
        <DocLead>
          No component in @spine/ui-native overrides Lucide&apos;s default 2px stroke width today — unlike web, which
          deliberately uses 1.75 for a cleaner read at small sizes. Worth revisiting once this library has more
          small, dense icon usage (a table-row action, for example) the way web does.
        </DocLead>
      </DocSection>

      <DocSection title="Common icons in this app">
        <View className="my-4 flex-row flex-wrap gap-4">
          {COMMON_ICONS.map(({ Icon, name }) => (
            <View
              key={name}
              className="w-24 items-center gap-2 rounded-md border border-border dark:border-border-dark p-3"
            >
              <Icon size={20} color={iconColor} />
              <Text className="text-[11px] text-on-surface-muted dark:text-on-surface-muted-dark">{name}</Text>
            </View>
          ))}
        </View>
      </DocSection>
    </DocScreen>
  );
}
