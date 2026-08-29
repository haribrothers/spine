import { StyleSheet, Text, View } from "react-native";

/** Placeholder — job list/detail (milestones, photos, notes, crew) lands in a later Phase 5 stage. */
export function JobsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Jobs</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 17 },
});
