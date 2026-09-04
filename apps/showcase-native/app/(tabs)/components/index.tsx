import { Pressable, ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useNativeColors } from "@spine/ui-native";
import { COMPONENT_CATALOG } from "../../../src/lib/component-catalog";

/**
 * The Components tab's own list UI — maps over `COMPONENT_CATALOG` (the
 * single static array this app uses instead of replicating
 * `apps/design-system-native`'s two-file nav-metadata pattern, see that
 * file's own doc comment) to render one row per component, linking to
 * `/components/[slug]`.
 *
 * `Link`'s `asChild` clones its `onPress` handler onto whatever it wraps —
 * a plain `View` has no press semantics at all, so `<Link asChild><View>`
 * renders a row that LOOKS tappable but never navigates. Confirmed as a
 * real, reproduced bug via actual tap testing on a real Android device
 * (`adb shell input tap`), not caught by typechecking. `Pressable` is
 * required as `asChild`'s direct child.
 */
export default function ComponentsScreen() {
  const colors = useNativeColors();

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="p-4 gap-2">
      {COMPONENT_CATALOG.map((entry) => (
        <Link key={entry.slug} href={`/components/${entry.slug}`} asChild>
          <Pressable className="flex-row items-center justify-between rounded-lg border border-border bg-surface p-3.5 dark:border-border-dark dark:bg-surface-dark active:bg-surface-sunken active:dark:bg-surface-sunken-dark">
            <View className="flex-1 gap-0.5 pr-2">
              <View className="flex-row items-center gap-2">
                <Text className="text-[15px] font-medium text-on-surface dark:text-on-surface-dark">{entry.title}</Text>
                {entry.native ? (
                  <View className="rounded-full bg-info-bg px-1.5 py-0.5 dark:bg-info-bg-dark">
                    <Text className="text-[10px] font-medium text-info dark:text-info-dark">Native</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{entry.description}</Text>
            </View>
            <ChevronRight size={18} color={colors.onSurfaceMuted} />
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}
