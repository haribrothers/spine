import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../src/navigation/root-navigator";
import { COMPONENT_SCREENS } from "../src/lib/component-screens";

type Props = NativeStackScreenProps<RootStackParamList, "Component">;

export function ComponentDetailScreen({ route }: Props) {
  const ScreenComponent = COMPONENT_SCREENS[route.params.slug];
  if (!ScreenComponent) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4">
        <Text className="text-on-surface-muted">No doc screen registered for &quot;{route.params.slug}&quot;.</Text>
      </View>
    );
  }
  return <ScreenComponent />;
}
