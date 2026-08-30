import { ScrollView, View } from "react-native";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spine/ui-native";

/**
 * Real integration proof for @spine/ui-native's foundational components
 * and NativeWind theming — S-11.2's actual home screen (today's assigned
 * jobs, tap-to-call, sync badge, backed by real API data) lands in a
 * later Phase 5 stage once the data layer exists; this renders the
 * components against real design tokens so the whole chain
 * (packages/ui-native -> tailwind.config.js -> NativeWind -> the app) is
 * exercised end-to-end, not just typechecked.
 */
export function HomeScreen() {
  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark">
      <View className="gap-4 p-4">
        <Card>
          <CardHeader>
            <View className="flex-row items-center justify-between">
              <CardTitle>Kitchen renovation</CardTitle>
              <Badge>Active</Badge>
            </View>
            <CardDescription>123 Example St · Jane Smith</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onPress={() => {}}>View job</Button>
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}
