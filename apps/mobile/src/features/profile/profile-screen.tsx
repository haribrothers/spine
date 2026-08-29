import { StyleSheet, Text, View } from "react-native";

/** Placeholder — profile/logout and theme preference (light/dark/system) land alongside auth in a later Phase 5 stage. */
export function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Profile</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 17 },
});
