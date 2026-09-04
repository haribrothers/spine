import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Spinner } from "@spine/ui-native";
import { authClient, useSession } from "../../lib/auth/auth-client";

/** S-11.1's sign-out half. Real profile/theme-preference screens land in a later Phase 5 stage. */
export function ProfileScreen() {
  // `as { user: { name: string | null; email: string } } | null` below is
  // the same documented widening as auth-client.ts's own cast — the
  // `expoClient as BetterAuthClientPlugin` cast there collapses
  // downstream session-type inference to `never`, so callers of
  // `useSession` type the fields they actually read by hand instead.
  const { data: session } = useSession() as { data: { user: { name: string | null; email: string } } | null };
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await authClient.signOut();
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{session?.user.name ?? session?.user.email}</Text>
      <Button onPress={handleSignOut} disabled={loading} variant="secondary">
        {loading ? <Spinner size="sm" label="Signing out" /> : "Sign out"}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  text: { fontSize: 17 },
});
