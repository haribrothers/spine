import { StyleSheet, Text, View } from "react-native";

/** Placeholder — expense submission with receipt capture (S-11.5) lands in a later Phase 5 stage. */
export function ExpensesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Expenses</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 17 },
});
