import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Button, TextField } from "@spine/ui-native";
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
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerClassName="flex-1 justify-center px-6" keyboardShouldPersistTaps="handled">
        <View className="gap-4">
          <Text className="text-[24px] font-bold text-on-surface">Sign in to Spine</Text>

          {error && (
            <View className="rounded-md border border-overdue bg-overdue-bg px-3 py-2">
              <Text className="text-[13px] text-overdue">{error}</Text>
            </View>
          )}

          <View className="gap-1">
            <Text className="text-[13px] font-semibold text-on-surface-muted">Email</Text>
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
            <Text className="text-[13px] font-semibold text-on-surface-muted">Password</Text>
            <TextField
              value={password}
              onChangeText={setPassword}
              accessibilityLabel="Password"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
            />
          </View>

          <Button onPress={handleSignIn} loading={loading} disabled={!email.trim() || !password}>
            Sign in
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
