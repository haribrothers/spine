import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Avatar, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, StatusChip } from "@spine/ui-native";

/**
 * Detail half of the List + Detail template. "Edit" pushes to
 * `/job-edit/[jobId]` — a TOP-LEVEL route OUTSIDE the `(tabs)` group
 * entirely (not nested under `templates/` anymore), so the Templates tab's
 * bottom tab bar isn't still mounted underneath it — see
 * `job-edit/[jobId].tsx`'s own doc comment for the full rationale (the
 * WhatsApp chat-screen pattern: a screen that isn't a descendant of the tab
 * navigator never has its tab bar rendered over it in the first place).
 *
 * Uses `router.push` — NOT `Link asChild` wrapping `Button`, since `Button`
 * is `@expo/ui`-backed (a native-bridge view) and this codebase's own
 * established rule is that `Link asChild` only reliably forwards its
 * cloned `onPress` onto a `Pressable`/other plain-RN touchable (see
 * `components/index.tsx`'s own doc comment on a real reproduced bug from
 * wrapping a plain `View`) — `Button` was never verified to behave like a
 * `Pressable` for this specific mechanism, so this uses `Button`'s own real
 * `onPress` prop instead of an unverified `asChild` combination.
 */
export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: `Job #${jobId}` }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="p-4 gap-4">
        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-3">
              <Avatar fallback="AC" size="lg" />
              <View>
                <CardTitle>Kitchen extension</CardTitle>
                <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Acme Contracting Ltd.</Text>
              </View>
            </View>
          </CardHeader>
          <CardContent className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Status</Text>
              <StatusChip status="paid">Paid</StatusChip>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Value</Text>
              <Text className="text-[13px] font-medium text-on-surface dark:text-on-surface-dark">$18,400.00</Text>
            </View>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" onPress={() => router.push(`/job-edit/${jobId}`)}>
              Edit
            </Button>
            <Button onPress={() => {}}>View invoice</Button>
          </CardFooter>
        </Card>
      </ScrollView>
    </>
  );
}
