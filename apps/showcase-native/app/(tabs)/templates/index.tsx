import { Pressable, ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useNativeColors } from "@spine/ui-native";
import { TEMPLATE_CATALOG } from "../../../src/lib/template-catalog";

/** `Link` + `Pressable` (not `View`) — see `components/index.tsx`'s own doc comment for why. */
export default function TemplatesScreen() {
  const colors = useNativeColors();

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="p-4 gap-2">
      {TEMPLATE_CATALOG.map((entry) => (
        <Link key={entry.slug} href={`/templates/${entry.slug}`} asChild>
          <Pressable className="flex-row items-center justify-between rounded-lg border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark active:bg-surface-sunken active:dark:bg-surface-sunken-dark">
            <View className="flex-1 gap-0.5 pr-2">
              <Text className="text-[15px] font-medium text-on-surface dark:text-on-surface-dark">{entry.title}</Text>
              <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{entry.description}</Text>
            </View>
            <ChevronRight size={18} color={colors.onSurfaceMuted} />
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}
