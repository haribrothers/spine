import { FlatList, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { COMPONENT_REGISTRY } from "../src/lib/component-registry";
import type { RootStackParamList } from "../src/navigation/root-navigator";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="p-4 gap-2"
      data={COMPONENT_REGISTRY}
      keyExtractor={(item) => item.slug}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Component", { slug: item.slug })}
          className="gap-1 rounded-lg border border-border bg-surface p-4 active:bg-surface-sunken"
        >
          <Text className="text-[15px] font-semibold text-on-surface">{item.name}</Text>
          <Text className="text-[13px] text-on-surface-muted">{item.description}</Text>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View className="h-2" />}
    />
  );
}
