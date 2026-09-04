import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Button, Spinner, TextField } from "@spine/ui-native";
import { authClient } from "../../lib/auth/auth-client";

/**
 * S-11.1 — sign in. `expoClient`'s `signIn.email` (re-exported as
 * `authClient.signIn.email` via `auth-client.ts`) persists the resulting
 * session via `expo-secure-store` automatically; nothing here manages
 * that storage directly. On success, `useSession` (subscribed wherever
 * the root navigator branches on auth state) picks up the new session
 * and swaps to the real tab navigator — this screen doesn't navigate
 * itself.
 */
export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email: email.trim(), password });
      if (signInError) {
        setError(signInError.message ?? "Could not sign in. Check your email and password.");
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background dark:bg-background-dark"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerClassName="flex-1 justify-center px-6" keyboardShouldPersistTaps="handled">
        <View className="gap-4">
          <Text className="text-[24px] font-bold text-on-surface dark:text-on-surface-dark">Sign in to Spine</Text>

          {error && (
            <View className="rounded-md border border-overdue dark:border-overdue-dark bg-overdue-bg dark:bg-overdue-bg-dark px-3 py-2">
              <Text className="text-[13px] text-overdue dark:text-overdue-dark">{error}</Text>
            </View>
          )}

          <View className="gap-1">
            <Text className="text-[13px] font-semibold text-on-surface-muted dark:text-on-surface-muted-dark">Email</Text>
            <TextField
              value={email}
              onChangeText={setEmail}
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <View className="gap-1">
            <Text className="text-[13px] font-semibold text-on-surface-muted dark:text-on-surface-muted-dark">Password</Text>
            <TextField
              value={password}
              onChangeText={setPassword}
              accessibilityLabel="Password"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
            />
          </View>

          <Button onPress={handleSignIn} disabled={loading || !email.trim() || !password}>
            {loading ? <Spinner size="sm" label="Signing in" /> : "Sign in"}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
