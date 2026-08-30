import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../src/navigation/root-navigator";
import { ButtonScreen } from "./components/button";
import { TextFieldScreen } from "./components/text-field";
import { CardScreen } from "./components/card";
import { BadgeScreen } from "./components/badge";

type Props = NativeStackScreenProps<RootStackParamList, "Component">;

/** Maps each registry slug to its doc screen — keep in sync with src/lib/component-registry.ts. */
const SCREENS: Record<string, React.ComponentType> = {
  button: ButtonScreen,
  "text-field": TextFieldScreen,
  card: CardScreen,
  badge: BadgeScreen,
};

export function ComponentDetailScreen({ route }: Props) {
  const ScreenComponent = SCREENS[route.params.slug];
  if (!ScreenComponent) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4">
        <Text className="text-on-surface-muted">No doc screen registered for &quot;{route.params.slug}&quot;.</Text>
      </View>
    );
  }
  return <ScreenComponent />;
}
