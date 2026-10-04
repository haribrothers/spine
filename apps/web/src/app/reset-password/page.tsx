"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input, Spinner } from "@spine/ui";
import { AuthPageShell } from "../../components/auth-page-shell";
import { apiClient } from "../../lib/api-client";
import { authClient } from "../../lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

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
    const tooShort = password.length < MIN_PASSWORD_LENGTH;
    const mismatch = password !== confirm;
    setPasswordError(tooShort ? "Use at least 8 characters." : undefined);
    setConfirmError(mismatch ? "The passwords don't match." : undefined);
    if (tooShort || mismatch) return;

    setSaving(true);
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
    if (resetError) {
      setSaving(false);
      if (resetError.code === "INVALID_TOKEN") setLink({ kind: "invalid" });
      else setError(resetError.message ?? "Couldn't save the password. Try again.");
      return;
    }
    const { error: signInError } = await authClient.signIn.email({ email: link.email, password });
    setSaving(false);
    // The password is saved either way; if signing in fails, log in by hand.
    router.push(signInError ? "/login" : "/dashboard");
  }

  return (
    <AuthPageShell>
      {link.kind === "checking" ? (
        <Spinner />
      ) : link.kind === "invalid" ? (
        <Card className="w-full max-w-sm" data-testid="reset-link-invalid">
          <CardHeader>
            <CardTitle>This link can&apos;t be used</CardTitle>
            <CardDescription>Reset links work once and expire after 1 hour.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/forgot-password">Request a new one</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Choose a new password</CardTitle>
              <CardDescription>For {link.email}. You&apos;ll be signed out on your other devices.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
                {error && (
                  <Alert variant="critical">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <FormField label="New password" helperText="At least 8 characters." errorText={passwordError} required>
                  {(field) => (
                    <Input {...field} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  )}
                </FormField>
                <FormField label="Confirm new password" errorText={confirmError} required>
                  {(field) => (
                    <Input {...field} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  )}
                </FormField>
                <Button type="submit" disabled={saving} className="mt-1">
                  {saving ? <Spinner size="sm" /> : "Save password"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="text-[13px] text-on-surface-muted">
            Link expired or already used?{" "}
            <Link href="/forgot-password" className="text-primary hover:underline">
              Request a new one.
            </Link>
          </p>
        </>
      )}
    </AuthPageShell>
  );
}
