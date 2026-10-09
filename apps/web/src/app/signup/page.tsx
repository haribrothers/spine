"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, Button, FormField, Input, PasswordInput, PasswordStrengthMeter, Spinner } from "@spine/ui";
import { PASSWORDS_DONT_MATCH_MESSAGE, PASSWORD_TOO_COMMON_MESSAGE, passwordProblem } from "@spine/shared";
import { authClient } from "../../lib/auth-client";
import { apiClient } from "../../lib/api-client";
import { AuthFrame, AuthHeading } from "../../components/auth-frame";
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

const ROLE_LABELS: Record<string, string> = { owner: "Owner", staff: "Staff", field: "Field" };

/** `GET /public/invitations/:id` while the invitation can still be used (US-AUTH-11). */
type InvitationPreview = { status: "pending"; email: string; role: string; organizationName: string } | { status: string };

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
  const [invitation, setInvitation] = useState<{ organizationName: string; role: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(invitedEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // US-AUTH-14: an invitation says whose Spine it is and the role it gives.
  useEffect(() => {
    if (!inviteId) return;
    apiClient
      .get<InvitationPreview>(`/public/invitations/${inviteId}`)
      .then((data) => {
        if ("organizationName" in data) setInvitation({ organizationName: data.organizationName, role: data.role });
      })
      .catch(() => {});
  }, [inviteId]);

  function checkConfirm(value = confirm) {
    setConfirmError(value && value !== password ? PASSWORDS_DONT_MATCH_MESSAGE : undefined);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // US-AUTH-15: refused here exactly as the server would refuse it; weaker passwords are only a warning.
    const problem = passwordProblem(password);
    const mismatch = password !== confirm;
    setPasswordError(problem ?? undefined);
    setConfirmError(mismatch ? PASSWORDS_DONT_MATCH_MESSAGE : undefined);
    if (problem || mismatch) return;

    setLoading(true);
    const { error: signUpError } = await authClient.signUp.email({ name, email, password });
    setLoading(false);

    if (signUpError) {
      if (signUpError.code === "PASSWORD_TOO_COMMON") setPasswordError(PASSWORD_TOO_COMMON_MESSAGE);
      else setError(signUpError.message ?? "Could not create your account. Please try again.");
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

  // US-AUTH-08: an existing install takes new people by invitation only.
  if (!inviteId && signupStatus === null) {
    return (
      <AuthFrame scene="welcome">
        <Spinner />
      </AuthFrame>
    );
  }
  if (!inviteId && !signupStatus?.open) {
    return (
      <AuthFrame scene="login">
        <div data-testid="signup-closed" className="flex flex-col gap-6">
          <AuthHeading title="This Spine is invite-only">
            {signupStatus?.businessName ?? "This business"} already has an owner, so new accounts are created by invitation. Ask an owner to
            invite you — you&apos;ll get an email with a link to join.
          </AuthHeading>
          <Button asChild size="touch">
            <Link href="/login">Log in</Link>
          </Button>
          <p className="text-center text-[13px] text-on-surface-muted">Already have an invite? Open the link in your email.</p>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame scene={inviteId ? "login" : "welcome"}>
      {inviteId ? (
        <AuthHeading title={invitation ? `Join ${invitation.organizationName} on Spine` : "Create your account"}>
          {invitation
            ? `You've been invited as ${ROLE_LABELS[invitation.role] ?? invitation.role}. Create your account to accept.`
            : "Finish creating your account to accept the invitation."}
        </AuthHeading>
      ) : (
        <AuthHeading title="Create your account">Sets up a new organisation with you as the owner.</AuthHeading>
      )}

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {error && (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField label="Name" required>
          {(field) => <Input {...field} type="text" autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />}
        </FormField>

        <FormField label="Email" required>
          {(field) => (
            <Input {...field} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(invitedEmail)} required />
          )}
        </FormField>

        <FormField label="Password" errorText={passwordError} required>
          {(field) => (
            <div className="flex flex-col gap-2">
              <PasswordInput
                {...field}
                aria-describedby={[field["aria-describedby"], "signup-password-strength"].filter(Boolean).join(" ")}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(undefined);
                }}
                required
              />
              <PasswordStrengthMeter id="signup-password-strength" password={password} />
            </div>
          )}
        </FormField>

        <FormField label="Confirm password" errorText={confirmError} required>
          {(field) => (
            <PasswordInput
              {...field}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (confirmError) checkConfirm(e.target.value);
              }}
              onBlur={() => checkConfirm()}
              required
            />
          )}
        </FormField>

        <Button type="submit" size="touch" disabled={loading} className="mt-1">
          {loading ? "Creating your account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] text-on-surface-muted">
        Already have an account?{" "}
        <Link href={inviteId ? `/login?next=/accept-invite/${inviteId}` : "/login"} className="text-primary hover:underline">
          Log in
        </Link>
      </p>
    </AuthFrame>
  );
}
