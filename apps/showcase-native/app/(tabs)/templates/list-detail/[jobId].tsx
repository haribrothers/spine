import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Avatar, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, StatusChip } from "@spine/ui-native";

/** Detail half of the List + Detail template. */
export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();

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
            <Button variant="secondary" onPress={() => {}}>
              Edit
            </Button>
            <Button onPress={() => {}}>View invoice</Button>
          </CardFooter>
        </Card>
      </ScrollView>
    </>
  );
}
