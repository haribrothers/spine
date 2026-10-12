"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, FormField, PasswordInput, PasswordStrengthMeter, Spinner } from "@spine/ui";
import { PASSWORDS_DONT_MATCH_MESSAGE, passwordProblem } from "@spine/shared";
import { AuthFrame, AuthHeading } from "../../components/auth-frame";
import { ApiError, apiClient } from "../../lib/api-client";
import { authClient } from "../../lib/auth-client";
import type { MemberRow } from "../../lib/members";

export default function ChoosePasswordPage() {
  return (
    <Suspense>
      <ChoosePasswordForm />
    </Suspense>
  );
}

/** Only an in-app path; anything else goes to the dashboard. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/choose-password") ? next : "/dashboard";
}

/**
 * US-TEAM-24 (D-233) — `ChooseOwnPassword`: after an Owner set this
 * person's password, their next sign-in lands here before anything else
 * (the app layout redirects, and the API answers PASSWORD_CHANGE_REQUIRED).
 * It says who set it and when; the new password can't be the one they were
 * given. Saving keeps this session and ends any others.
 */
function ChoosePasswordForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [me, setMe] = useState<MemberRow | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get<MemberRow>("/org/members/me")
      .then((row) => {
        // Nothing to choose: carry on to where they were going.
        if (!row.mustChangePassword) router.replace(next);
        else setMe(row);
      })
      .catch(() => router.replace(`/login?next=${encodeURIComponent(next)}`));
  }, [next, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = passwordProblem(password);
    const mismatch = password !== confirm;
    setPasswordError(problem ?? undefined);
    setConfirmError(mismatch ? PASSWORDS_DONT_MATCH_MESSAGE : undefined);
    if (problem || mismatch) return;
    setSaving(true);
    try {
      await apiClient.put("/org/members/me/password", { newPassword: password });
      router.replace(next);
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError && err.status === 400) setPasswordError(err.message);
      else setError(err instanceof Error ? err.message : "Couldn't save your password. Try again.");
    }
  }

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
  }

  const setBy = me?.passwordSetBy;
  const when = setBy?.at ? new Date(setBy.at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null;
  return (
    <AuthFrame scene="login">
      {!me ? (
        <Spinner />
      ) : (
        <>
          <AuthHeading title="Choose your own password">
            {setBy?.name ? `${setBy.name} set a password for you${when ? ` on ${when}` : ""}.` : "An owner set a password for you."} Choose one only you know to keep going — it signs you in from now on.
          </AuthHeading>
          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate data-testid="choose-password-form">
            {error && (
              <Alert variant="critical">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField label="New password" helperText="At least 8 characters, not the one you were given." errorText={passwordError} required>
              {(field) => (
                <div className="flex flex-col gap-2">
                  <PasswordInput
                    {...field}
                    aria-describedby={[field["aria-describedby"], "choose-password-strength"].filter(Boolean).join(" ")}
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError(undefined);
                    }}
                  />
                  <PasswordStrengthMeter id="choose-password-strength" password={password} />
                </div>
              )}
            </FormField>
            <FormField label="Confirm password" errorText={confirmError} required>
              {(field) => <PasswordInput {...field} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
            </FormField>
            <Button type="submit" size="touch" disabled={saving} className="mt-1">
              {saving ? <Spinner size="sm" /> : "Save and continue"}
            </Button>
          </form>
          <p className="mt-5 text-center text-[13px] text-on-surface-muted">
            Not you?{" "}
            <button type="button" onClick={() => void signOut()} className="text-primary hover:underline">
              Sign out
            </button>
          </p>
          <p className="mt-3 text-center text-[12.5px] text-on-surface-muted">Nobody else at {me.organizationName ?? "your business"} will see it.</p>
        </>
      )}
    </AuthFrame>
  );
}
