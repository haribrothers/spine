"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input, SpineLogo, Spinner } from "@spine/ui";
import { authClient } from "../../lib/auth-client";
import { ThemeToggle } from "../../components/theme-toggle";
import { useSignupStatus } from "../../lib/signup-status";

export default function SignupPage() {
  return (
    // useSearchParams (inviteId/email for the invited-user variant) needs a
    // Suspense boundary or Next.js bails out this route's static prerender.
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set by accept-invite's "Create account" link — when present, this
  // signup is for an existing org invite, not a brand-new org: lock the
  // email to the invited address and land back on the accept screen
  // afterward instead of the onboarding wizard, which assumes a fresh org.
  const inviteId = searchParams.get("inviteId");
  const invitedEmail = searchParams.get("email");

  const signupStatus = useSignupStatus();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(invitedEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message ?? "Could not create your account. Please try again.");
      return;
    }

    if (inviteId) {
      router.push(`/accept-invite/${inviteId}`);
      return;
    }

    // Land a brand-new org straight into the onboarding wizard, not the
    // dashboard — the wizard itself is always skippable from its first
    // screen, so this doesn't gate anything, it's just the natural first
    // stop after creating a fresh organisation.
    router.push("/onboarding");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex w-full max-w-sm items-center justify-center">
        <SpineLogo variant="horizontal" size={140} />
      </div>
      <ThemeToggle />
      {/* US-AUTH-08: an existing install takes new people by invitation only. */}
      {!inviteId && signupStatus === null ? (
        <Spinner />
      ) : !inviteId && !signupStatus?.open ? (
        <Card className="w-full max-w-sm" data-testid="signup-closed">
          <CardHeader>
            <CardTitle>This Spine is invite-only</CardTitle>
            <CardDescription>
              {signupStatus?.businessName ?? "This business"} already has an owner, so new accounts are created by invitation. Ask an owner
              to invite you — you&apos;ll get an email with a link to join.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <p className="text-center text-[13px] text-on-surface-muted">Already have an invite? Open the link in your email.</p>
          </CardContent>
        </Card>
      ) : (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            {inviteId ? "Finish creating your account to accept the invitation." : "Sets up a new organisation with you as the owner."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {error && (
              <Alert variant="critical">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField label="Name" required>
              {(field) => (
                <Input
                  {...field}
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
            </FormField>

            <FormField label="Email" required>
              {(field) => (
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={Boolean(invitedEmail)}
                  required
                />
              )}
            </FormField>

            <FormField label="Password" required>
              {(field) => (
                <Input
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              )}
            </FormField>

            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? <Spinner size="sm" /> : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-[13px] text-on-surface-muted">
            Already have an account?{" "}
            <Link href={inviteId ? `/login?next=/accept-invite/${inviteId}` : "/login"} className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
      )}
    </main>
  );
}
