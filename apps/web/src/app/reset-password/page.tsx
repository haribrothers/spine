"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, Button, FormField, PasswordInput, PasswordStrengthMeter, Spinner } from "@spine/ui";
import { AuthFrame, AuthHeading } from "../../components/auth-frame";
import { PASSWORDS_DONT_MATCH_MESSAGE, PASSWORD_TOO_COMMON_MESSAGE, passwordProblem } from "@spine/shared";
import { apiClient } from "../../lib/api-client";
import { authClient } from "../../lib/auth-client";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

type LinkState = { kind: "checking" } | { kind: "invalid" } | { kind: "valid"; email: string };

/**
 * US-AUTH-10 — choose a new password from the emailed link. Saving signs
 * the account out everywhere (Better Auth `revokeSessionsOnPasswordReset`),
 * then signs this browser in with the new password.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [link, setLink] = useState<LinkState>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setLink({ kind: "invalid" });
      return;
    }
    apiClient
      .get<{ email: string }>(`/public/password-reset/${encodeURIComponent(token)}`)
      .then(({ email }) => setLink({ kind: "valid", email }))
      .catch(() => setLink({ kind: "invalid" }));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (link.kind !== "valid") return;
    setError(null);
    // US-AUTH-15: the same rules as sign-up and the server.
    const problem = passwordProblem(password);
    const mismatch = password !== confirm;
    setPasswordError(problem ?? undefined);
    setConfirmError(mismatch ? PASSWORDS_DONT_MATCH_MESSAGE : undefined);
    if (problem || mismatch) return;

    setSaving(true);
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
    if (resetError) {
      setSaving(false);
      if (resetError.code === "INVALID_TOKEN") setLink({ kind: "invalid" });
      else if (resetError.code === "PASSWORD_TOO_COMMON") setPasswordError(PASSWORD_TOO_COMMON_MESSAGE);
      else setError(resetError.message ?? "Couldn't save the password. Try again.");
      return;
    }
    const { error: signInError } = await authClient.signIn.email({ email: link.email, password });
    setSaving(false);
    // The password is saved either way; if signing in fails, log in by hand.
    router.push(signInError ? "/login" : "/dashboard");
  }

  return (
    <AuthFrame scene="login">
      {link.kind === "checking" ? (
        <Spinner />
      ) : link.kind === "invalid" ? (
        <div data-testid="reset-link-invalid" className="flex flex-col gap-6">
          <AuthHeading title="This link can't be used">Reset links work once and expire after 1 hour.</AuthHeading>
          <Button asChild size="touch" className="w-full">
            <Link href="/forgot-password">Request a new one</Link>
          </Button>
        </div>
      ) : (
        <>
          <AuthHeading title="Choose a new password">For {link.email}. You&apos;ll be signed out on your other devices.</AuthHeading>
          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            {error && (
              <Alert variant="critical">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField label="New password" helperText="At least 8 characters." errorText={passwordError} required>
              {(field) => (
                <div className="flex flex-col gap-2">
                  <PasswordInput
                    {...field}
                    aria-describedby={[field["aria-describedby"], "reset-password-strength"].filter(Boolean).join(" ")}
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError(undefined);
                    }}
                  />
                  <PasswordStrengthMeter id="reset-password-strength" password={password} />
                </div>
              )}
            </FormField>
            <FormField label="Confirm new password" errorText={confirmError} required>
              {(field) => <PasswordInput {...field} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
            </FormField>
            <Button type="submit" size="touch" disabled={saving} className="mt-1">
              {saving ? <Spinner size="sm" /> : "Save password"}
            </Button>
          </form>
          <p className="mt-5 text-center text-[13px] text-on-surface-muted">
            Link expired or already used?{" "}
            <Link href="/forgot-password" className="text-primary hover:underline">
              Request a new one.
            </Link>
          </p>
        </>
      )}
    </AuthFrame>
  );
}
