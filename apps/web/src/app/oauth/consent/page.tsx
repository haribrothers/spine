"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, Bot, CircleCheck, Globe, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, Avatar, AvatarFallback, AvatarImage, Button, Checkbox, Spinner } from "@spine/ui";
import { initials } from "../../../lib/initials";
import { AGENT_SCOPES, agentsOffMessage, consentLines, type AgentConsentInfo } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { authClient } from "../../../lib/auth-client";
import { AuthFrame, AuthHeading } from "../../../components/auth-frame";
import { AgentScene } from "../agent-scene";
import { t as translate, useT } from "../../../lib/i18n";

export default function AgentConsentPage() {
  return (
    <Suspense>
      <Consent />
    </Suspense>
  );
}

const ROLE_LABEL = { owner: translate("oauth.roles.owner"), staff: translate("oauth.roles.staff"), field: translate("oauth.roles.field") } as const;

/**
 * US-MCP-03 (D-256, D-258) — "<Agent> wants to use Spine as you". Better
 * Auth sends the person here, signed in, with the agent's signed request.
 * The page says, for their role, what the agent can and can't do and where
 * what it reads goes; drafts are a box they can untick. Allow and Cancel
 * answer Better Auth, which sends the browser back to the agent.
 */
function Consent() {
  const t = useT();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [info, setInfo] = useState<AgentConsentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState(true);
  const [busy, setBusy] = useState<"allow" | "cancel" | null>(null);

  useEffect(() => {
    apiClient
      .get<AgentConsentInfo>(`/agent-consent?${query}`)
      .then(setInfo)
      .catch((err) => setError(err instanceof Error ? err.message : t("oauth.consent.expired")));
  }, [query]);

  async function answer(accept: boolean) {
    setError(null);
    setBusy(accept ? "allow" : "cancel");
    const requested = (searchParams.get("scope") ?? "").split(" ").filter(Boolean);
    const scope = requested.filter((s) => s !== AGENT_SCOPES.draft || (info?.draftsOffered && drafts)).join(" ");
    const { data, error: consentError } = await authClient.$fetch<{ redirect?: boolean; url?: string }>("/oauth2/consent", { method: "POST", body: accept ? { accept, scope } : { accept } });
    if (consentError || !data?.url) {
      setBusy(null);
      setError(consentError?.message ?? t("oauth.consent.answerFailed"));
      return;
    }
    window.location.assign(data.url);
  }

  async function notYou() {
    await authClient.signOut();
    window.location.assign(`/login?${query}`);
  }

  if (!info) {
    return (
      <AuthFrame scene="login">
        {error ? (
          <>
            <AuthHeading title={t("oauth.consent.cantUseTitle")}>{error}</AuthHeading>
          </>
        ) : (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}
      </AuthFrame>
    );
  }

  if (info.off) {
    return (
      <AuthFrame scene="login">
        <AuthHeading title={t("oauth.consent.offTitle")}>{agentsOffMessage(info.business)}</AuthHeading>
      </AuthFrame>
    );
  }

  const lines = consentLines(info.person.role, info.agent);
  const allowDrafts = info.draftsOffered && drafts;
  const scene = {
    name: info.person.name,
    detail: t("oauth.consent.businessRole", { business: info.business, role: ROLE_LABEL[info.person.role] }),
    lines: [
      { text: info.person.role === "field" ? t("oauth.consent.readsAssignedJobs", { name: info.person.name.split(" ")[0] }) : t("oauth.consent.readsWhatTheyCanSee", { name: info.person.name.split(" ")[0] }), ok: true },
      ...(allowDrafts ? [{ text: info.person.role === "field" ? t("oauth.consent.addsNotes") : t("oauth.consent.createsDrafts"), ok: true }] : []),
      { text: info.person.role === "field" ? t("oauth.consent.noMoney") : t("oauth.consent.neverIssues"), ok: false },
    ],
  };

  return (
    <AuthFrame scene="login" panel={<AgentScene agent={info.agent} person={scene} />}>
      <div className="flex flex-col" data-testid="agent-consent">
        <div className="mb-4 flex items-center gap-2.5" aria-hidden>
          <span className={`grid size-11 place-items-center rounded-xl ${info.agent.verified ? "bg-info-bg text-primary" : "bg-surface-sunken text-on-surface-muted"}`}>
            <Bot size={22} />
          </span>
          <span className="flex gap-[3px]">
            {[0, 1, 2].map((i) => (
              <i key={i} className="block size-1 rounded-full bg-border-strong" />
            ))}
          </span>
        </div>
        <AuthHeading title={lines.title} />
        <p className="mt-2.5 inline-flex w-fit flex-wrap items-center gap-2 rounded-md bg-surface-sunken px-2.5 py-1.5 text-[13px] font-medium text-on-surface" data-testid="agent-host">
          {info.agent.verified ? (
            <>
              <Globe size={14} aria-hidden className="text-on-surface-muted" />
              {info.agent.host}
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-on-surface-muted">
                <CircleCheck size={13} aria-hidden className="text-paid" />
                {t("oauth.consent.verifiedAddress")}
              </span>
            </>
          ) : (
            <>
              {t("oauth.consent.callsItself", { name: info.agent.name })}
              <span className="inline-flex items-center gap-1 rounded-full bg-due-soon-bg px-2 py-0.5 text-[11px] font-semibold text-due-soon">
                <TriangleAlert size={11} aria-hidden />
                {t("oauth.consent.unverifiedName")}
              </span>
            </>
          )}
        </p>

        <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-border p-3 text-[13px] text-on-surface-muted">
          <Avatar size="md">
            {info.person.image && <AvatarImage src={info.person.image} alt="" />}
            <AvatarFallback>{initials(info.person.name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            {t("oauth.consent.signedInAs")}
            <b className="font-semibold text-on-surface">{info.person.name}</b>
            <br />
            {t("oauth.consent.businessRole", { business: info.business, role: ROLE_LABEL[info.person.role] })}
          </span>
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => void notYou()}>
            {t("oauth.consent.notYou")}
          </button>
        </div>

        <ul className="mt-4 flex flex-col gap-2.5 text-[13.5px] text-on-surface">
          <li className="flex items-start gap-2.5">
            <CircleCheck size={16} aria-hidden className="mt-0.5 shrink-0 text-paid" />
            {lines.read}
          </li>
        </ul>
        {info.draftsOffered && (
          <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-[13.5px] text-on-surface">
            <Checkbox checked={drafts} onCheckedChange={(v) => setDrafts(v === true)} aria-describedby="consent-drafts-hint" className="mt-0.5" />
            <span>
              {lines.draftLabel}
              <small id="consent-drafts-hint" className="mt-0.5 block text-[12.5px] text-on-surface-muted">
                {lines.draftHint}
              </small>
            </span>
          </label>
        )}
        <p className="mt-3 flex items-start gap-2.5 text-[13.5px] text-on-surface-muted">
          <Ban size={16} aria-hidden className="mt-0.5 shrink-0" />
          {lines.cant}
        </p>
        <p className="mt-3 flex items-start gap-2 text-[12.5px] text-on-surface-muted" data-testid="agent-sends">
          <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0 text-due-soon" />
          {lines.sends}
        </p>

        {error && (
          <Alert variant="critical" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Button variant="secondary" size="touch" disabled={busy !== null} onClick={() => void answer(false)}>
            {busy === "cancel" ? t("oauth.consent.cancelling") : t("oauth.consent.cancel")}
          </Button>
          <Button size="touch" disabled={busy !== null} onClick={() => void answer(true)}>
            {busy === "allow" ? t("oauth.consent.allowing") : t("oauth.consent.allow")}
          </Button>
        </div>
      </div>
    </AuthFrame>
  );
}
