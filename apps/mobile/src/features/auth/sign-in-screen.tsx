import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { Button, FloatingLabelField, FormRow, FormSection, FullWidthButton, Spinner } from "@spine/ui-native";
import { useSession } from "../../lib/session/session-provider";
import { discoverServer, SignInError, type SignInField } from "../../lib/session/sign-in";

type Errors = Partial<Record<SignInField, string>>;

/**
 * US-MOB-01 · `MobSignIn` / `MobSignInAndroid` — server, email and password.
 * Errors sit under the field they're about; "Forgot password?" opens the
 * server's reset page in the phone's browser (D-052, US-AUTH-09). A removed
 * membership comes back here with its notice (US-MOB-02).
 */
export function SignInScreen() {
  const { state, signIn } = useSession();
  const signedOut = state.status === "signedOut" ? state : undefined;
  // EXPO_PUBLIC_DEFAULT_SERVER pre-fills the field in development (.env.development.example).
  const [server, setServer] = useState(signedOut?.lastServer ?? process.env.EXPO_PUBLIC_DEFAULT_SERVER ?? "");
  const [email, setEmail] = useState(signedOut?.lastEmail ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef(null);

  async function submit() {
    const next: Errors = {};
    if (!server.trim()) next.server = "Enter your server address — it's the link you open Spine with on a computer.";
    if (!email.trim()) next.email = "Enter the email your office invited you with.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const result = await signIn(server, email, password);
    setBusy(false);
    if (!result.ok) {
      setErrors(result.field === "password" ? { email: "", password: result.message } : { [result.field]: result.message });
    }
  }

  async function forgotPassword() {
    try {
      const info = await discoverServer(server);
      setErrors({});
      await WebBrowser.openBrowserAsync(`${info.appUrl}/forgot-password`);
    } catch (error) {
      if (error instanceof SignInError) setErrors({ server: error.message });
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="flex-grow px-5 pb-8 pt-16">
          <View className="gap-2 px-1">
            <Text accessibilityRole="header" className="text-[30px] font-bold text-on-surface dark:text-on-surface-dark">
              Sign in to Spine
            </Text>
            <Text className="text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark">Use the email your office invited you with.</Text>
          </View>

          {signedOut?.notice ? (
            <View className="mt-6 rounded-lg bg-overdue-bg px-4 py-3 dark:bg-overdue-bg-dark" accessibilityRole="alert">
              <Text className="text-[14px] font-medium text-overdue dark:text-overdue-dark">{signedOut.notice}</Text>
            </View>
          ) : null}

          <View className="mt-8 gap-2">
            <FormSection title="Your account">
              <FormRow error={errors.server}>
                <FloatingLabelField
                  label="Server"
                  value={server}
                  onChangeText={setServer}
                  error={Boolean(errors.server)}
                  forceTextField
                  autoCapitalize="none"
                  autoComplete="url"
                  returnKeyType="next"
                  testID="sign-in-server"
                />
              </FormRow>
              <FormRow error={errors.email || undefined}>
                <FloatingLabelField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  error={errors.email !== undefined}
                  keyboardType="email"
                  forceTextField
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                  testID="sign-in-email"
                />
              </FormRow>
              <FormRow error={errors.password} last>
                <FloatingLabelField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  error={Boolean(errors.password)}
                  secureTextEntry
                  autoComplete="current-password"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  inputRef={passwordRef}
                  testID="sign-in-password"
                />
              </FormRow>
            </FormSection>
            <Text className="px-1 text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">
              The server address is the link you open Spine with on a computer.
            </Text>
          </View>

          {errors.form ? (
            <Text accessibilityRole="alert" className="mt-4 px-1 text-[13px] text-overdue dark:text-overdue-dark">
              {errors.form}
            </Text>
          ) : null}

          <View className="mt-7 gap-3">
            {busy ? (
              <View className="h-12 items-center justify-center">
                <Spinner label="Signing in" />
              </View>
            ) : (
              <FullWidthButton label="Sign in" onPress={submit} testID="sign-in-submit" />
            )}
            <View className="items-center">
              <Button variant="ghost" label="Forgot password?" onPress={forgotPassword} testID="sign-in-forgot" />
            </View>
          </View>

          <View className="flex-1 justify-end pt-10">
            <Text className="text-center text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">
              You stay signed in on this phone until you sign out.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
