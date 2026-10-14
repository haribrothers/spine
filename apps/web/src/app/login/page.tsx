"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, Button, FormField, Input, PasswordInput } from "@spine/ui";
import { authClient } from "../../lib/auth-client";
import { AuthFrame, AuthHeading } from "../../components/auth-frame";
import { useSignupStatus } from "../../lib/signup-status";
import { safeNextPath } from "../../lib/safe-next";
import { TOO_MANY_ATTEMPTS_MESSAGE, WRONG_CREDENTIALS_MESSAGE } from "../../lib/auth-messages";

export default function LoginPage() {
  return (
    // useSearchParams (for the accept-invite "next" redirect) requires a
    // Suspense boundary — Next.js bails out the whole route's static
    // prerender otherwise. Everything else here has no reason to suspend,
    // so the fallback only shows for the instant it takes to read the URL.
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const signupStatus = useSignupStatus();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set by accept-invite when an invited person without a session needs to
  // log in first (Better Auth's acceptInvitation/getInvitation both require
  // an authenticated session matching the invited email) — send them back
  // to finish accepting instead of the default /dashboard landing.
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.status === 429 ? TOO_MANY_ATTEMPTS_MESSAGE : signInError.status === 401 || signInError.status === 400 ? WRONG_CREDENTIALS_MESSAGE : (signInError.message ?? WRONG_CREDENTIALS_MESSAGE));
      return;
    }

    router.push(safeNextPath(next) ?? "/dashboard");
  }

  return (
    <AuthFrame scene="login">
      <AuthHeading title="Log in">Welcome back to Spine.</AuthHeading>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        {error && (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField label="Email" required>
          {(field) => <Input {...field} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </FormField>

        <FormField label="Password" required>
          {(field) => <PasswordInput {...field} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </FormField>

        {/* US-AUTH-09 */}
        <Link href="/forgot-password" className="-mt-2 self-end text-[13px] text-primary hover:underline">
          Forgot password?
        </Link>

        <Button type="submit" size="touch" disabled={loading} className="mt-1">
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>

      {/* US-AUTH-08: only while the instance still takes a first account. */}
      {signupStatus?.open && (
        <p className="mt-5 text-center text-[13px] text-on-surface-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      )}
    </AuthFrame>
  );
}
