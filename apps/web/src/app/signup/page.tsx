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
import { t as translate, useT } from "../../lib/i18n";

export default function SignupPage() {
  return (
    // useSearchParams (inviteId/email for the invited-user variant) needs a
    // Suspense boundary or Next.js bails out this route's static prerender.
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

const ROLE_LABELS: Record<string, string> = { owner: translate("auth.roles.owner"), staff: translate("auth.roles.staff"), field: translate("auth.roles.field") };

/** `GET /public/invitations/:id` while the invitation can still be used (US-AUTH-11). */
type InvitationPreview = { status: "pending"; email: string; role: string; organizationName: string } | { status: string };

function SignupForm() {
  const t = useT();
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
      else setError(signUpError.message ?? t("auth.signup.failed"));
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
          <AuthHeading title={t("auth.signup.closedTitle")}>
            {t("auth.signup.closedBody", { business: signupStatus?.businessName ?? t("auth.signup.thisBusiness") })}
          </AuthHeading>
          <Button asChild size="touch">
            <Link href="/login">{t("auth.actions.logIn")}</Link>
          </Button>
          <p className="text-center text-[13px] text-on-surface-muted">{t("auth.signup.haveInvite")}</p>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame scene={inviteId ? "login" : "welcome"}>
      {inviteId ? (
        <AuthHeading title={invitation ? t("auth.signup.joinTitle", { organization: invitation.organizationName }) : t("auth.signup.createTitle")}>
          {invitation
            ? t("auth.signup.invitedAs", { role: ROLE_LABELS[invitation.role] ?? invitation.role })
            : t("auth.signup.finishToAccept")}
        </AuthHeading>
      ) : (
        <AuthHeading title={t("auth.signup.createTitle")}>{t("auth.signup.newOrganisation")}</AuthHeading>
      )}

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {error && (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField label={t("auth.fields.name")} required>
          {(field) => <Input {...field} type="text" autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />}
        </FormField>

        <FormField label={t("auth.fields.email")} required>
          {(field) => (
            <Input {...field} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(invitedEmail)} required />
          )}
        </FormField>

        <FormField label={t("auth.fields.password")} errorText={passwordError} required>
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

        <FormField label={t("auth.fields.confirmPassword")} errorText={confirmError} required>
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
          {loading ? t("auth.signup.creating") : t("auth.actions.createAccount")}
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] text-on-surface-muted">
        {t("auth.signup.haveAccount")}{" "}
        <Link href={inviteId ? `/login?next=/accept-invite/${inviteId}` : "/login"} className="text-primary hover:underline">
          {t("auth.actions.logIn")}
        </Link>
      </p>
    </AuthFrame>
  );
}
