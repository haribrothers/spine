import { StyleSheet, Text, View } from "react-native";

/** Placeholder — S-11.2's real home screen (today's assigned jobs, tap-to-call, sync badge) lands once packages/ui-native and the API-backed data layer exist. */
export function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Home</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 17 },
});
