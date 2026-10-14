import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, FloatingLabelField, FormRow, FormSection, FullWidthButton, OutlinedTextField, Spinner } from "@spine/ui-native";
import { PASSWORD_LEVEL_LABELS, PASSWORDS_DONT_MATCH_MESSAGE, passwordProblem, passwordStrength } from "@spine/shared/password";
import { ApiError } from "../../lib/api/errors";
import { useSession, useSignedInSession } from "../../lib/session/session-provider";
import { SignInCompactLogo } from "./sign-in-hero";

type Errors = { password?: string; confirm?: string; form?: string };

/** "12 Oct", or nothing when the server didn't say. */
function shortDay(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * US-TEAM-24 (D-233) · `ChooseOwnPasswordMobile` — after an Owner set this
 * person's password, the field app opens here before anything else: who
 * set it, a new password and Confirm. It can't be the one they were given
 * (the server says so under the field). "Save and continue" opens Today;
 * "Sign out" leaves. Every other request answers PASSWORD_CHANGE_REQUIRED
 * until then, which brings them back here.
 */
export function ChoosePasswordScreen() {
  const { choosePassword, signOut } = useSession();
  const { member } = useSignedInSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const setBy = member.passwordSetBy;
  const day = shortDay(setBy?.at);
  const intro = setBy?.name ? `${setBy.name} set a password for you${day ? ` on ${day}` : ""}.` : "An owner set a password for you.";
  const strength = password ? passwordStrength(password) : null;

  async function submit() {
    const problem = passwordProblem(password);
    const next: Errors = {};
    if (problem) next.password = problem;
    if (password !== confirm) next.confirm = PASSWORDS_DONT_MATCH_MESSAGE;
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await choosePassword(password);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) setErrors({ password: error.message });
      else setErrors({ form: error instanceof Error ? error.message : "Couldn't save your password. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const strengthLine = strength ? `Password strength: ${PASSWORD_LEVEL_LABELS[strength.level]}` : "At least 8 characters, not the one you were given.";
  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="flex-grow px-5 pb-8">
          <SignInCompactLogo />
          <View className="mt-4 gap-2 px-1">
            <Text accessibilityRole="header" className={`text-[28px] text-on-surface dark:text-on-surface-dark ${Platform.OS === "android" ? "" : "font-bold"}`}>
              Choose your own password
            </Text>
            <Text className="text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark" testID="choose-password-intro">
              {intro} Choose one only you know to keep going.
            </Text>
          </View>

          {Platform.OS === "android" ? (
            <View className="mt-6 gap-4">
              <OutlinedTextField
                label="New password"
                value={password}
                onChangeText={setPassword}
                error={Boolean(errors.password)}
                helperText={errors.password ?? strengthLine}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="next"
                testID="choose-password-new"
              />
              <OutlinedTextField
                label="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                error={Boolean(errors.confirm)}
                helperText={errors.confirm}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="go"
                onSubmitEditing={submit}
                testID="choose-password-confirm"
              />
            </View>
          ) : (
            <View className="mt-6 gap-2">
              <FormSection title="New password">
                <FormRow error={errors.password}>
                  <FloatingLabelField
                    label="New password"
                    value={password}
                    onChangeText={setPassword}
                    error={Boolean(errors.password)}
                    secureTextEntry
                    autoComplete="new-password"
                    returnKeyType="next"
                    testID="choose-password-new"
                  />
                </FormRow>
                <FormRow error={errors.confirm} last>
                  <FloatingLabelField
                    label="Confirm password"
                    value={confirm}
                    onChangeText={setConfirm}
                    error={Boolean(errors.confirm)}
                    secureTextEntry
                    autoComplete="new-password"
                    returnKeyType="go"
                    onSubmitEditing={submit}
                    testID="choose-password-confirm"
                  />
                </FormRow>
              </FormSection>
              {!errors.password ? <Text className="px-1 text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">{strengthLine}</Text> : null}
            </View>
          )}

          {errors.form ? (
            <Text accessibilityRole="alert" className="mt-4 px-1 text-[13px] text-overdue dark:text-overdue-dark">
              {errors.form}
            </Text>
          ) : null}

          <View className="mt-7 gap-3">
            {busy ? (
              <View className="h-12 items-center justify-center">
                <Spinner label="Saving your password" />
              </View>
            ) : (
              <FullWidthButton label="Save and continue" onPress={submit} testID="choose-password-submit" />
            )}
            <View className="items-center">
              <Button variant="ghost" label="Sign out" onPress={() => void signOut()} testID="choose-password-sign-out" />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
