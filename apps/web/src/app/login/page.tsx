"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plug, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, Button, FormField, Input, PasswordInput } from "@spine/ui";
import { authClient } from "../../lib/auth-client";
import { AuthFrame, AuthHeading } from "../../components/auth-frame";
import { useSignupStatus } from "../../lib/signup-status";
import { safeNextPath } from "../../lib/safe-next";
import { TOO_MANY_ATTEMPTS_MESSAGE, WRONG_CREDENTIALS_MESSAGE } from "../../lib/auth-messages";
import { agentSignInNote, type AgentIdentity } from "@spine/shared";
import { apiClient } from "../../lib/api-client";
import { AgentScene } from "../oauth/agent-scene";
import { useT } from "../../lib/i18n";

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
  const t = useT();
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
  // US-MCP-03: an agent's sign-in sent them here with a signed query; say which agent is asking.
  const [agent, setAgent] = useState<AgentIdentity | null>(null);
  const agentQuery = searchParams.has("sig") && searchParams.has("client_id") ? searchParams.toString() : null;
  useEffect(() => {
    if (!agentQuery) return;
    apiClient
      .get<AgentIdentity>(`/agent-consent/agent?${agentQuery}`)
      .then(setAgent)
      .catch(() => setAgent(null));
  }, [agentQuery]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.status === 429 ? TOO_MANY_ATTEMPTS_MESSAGE : signInError.status === 401 || signInError.status === 400 ? WRONG_CREDENTIALS_MESSAGE : (signInError.message ?? WRONG_CREDENTIALS_MESSAGE));
      return;
    }

    // US-MCP-03: signing in for an agent continues its sign-in (to the consent page, or back to the agent).
    const redirect = data as { redirect?: boolean; url?: string } | null;
    if (redirect?.redirect && redirect.url) {
      window.location.assign(redirect.url);
      return;
    }
    router.push(safeNextPath(next) ?? "/dashboard");
  }

  return (
    <AuthFrame scene="login" panel={agent ? <AgentScene agent={agent} /> : undefined}>
      {agent && (
        <p className="mb-6 flex items-start gap-2.5 rounded-md border border-primary/20 bg-info-bg p-3 text-[13px] text-on-surface" data-testid="agent-signin-note">
          <Plug size={16} aria-hidden className="mt-0.5 shrink-0 text-primary" />
          {agentSignInNote(agent)}
        </p>
      )}
      <AuthHeading title={t("auth.login.title")}>{t("auth.login.subtitle")}</AuthHeading>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        {error && (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField label={t("auth.fields.email")} required>
          {(field) => <Input {...field} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </FormField>

        <FormField label={t("auth.fields.password")} required>
          {(field) => <PasswordInput {...field} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </FormField>

        {/* US-AUTH-09 */}
        <Link href="/forgot-password" className="-mt-2 self-end text-[13px] text-primary hover:underline">
          {t("auth.login.forgotPassword")}
        </Link>

        <Button type="submit" size="touch" disabled={loading} className="mt-1">
          {loading ? t("auth.login.loggingIn") : t("auth.actions.logIn")}
        </Button>
        {agent && (
          <p className="flex items-center gap-2 text-[13px] text-on-surface-muted">
            <ShieldCheck size={16} aria-hidden className="shrink-0 text-paid" />
            {t("auth.login.agentPasswordNote", { agent: agent.verified ? agent.name : t("auth.login.theAgent") })}
          </p>
        )}
      </form>

      {/* US-AUTH-08: only while the instance still takes a first account. */}
      {signupStatus?.open && (
        <p className="mt-5 text-center text-[13px] text-on-surface-muted">
          {t("auth.login.noAccount")}{" "}
          <Link href="/signup" className="text-primary hover:underline">
            {t("auth.login.signUp")}
          </Link>
        </p>
      )}
    </AuthFrame>
  );
}
