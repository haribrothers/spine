import { Ban, Bot, Building2, CircleCheck } from "lucide-react";
import { SpineLogo } from "@spine/ui";
import type { AgentIdentity } from "@spine/shared";
import styles from "./agent-scene.module.css";
import { t } from "../../lib/i18n";

/**
 * US-MCP-03 — the signed-out frame's picture while an agent connects: the
 * agent on top, Spine's mark, and below it the person it will act as (or,
 * before sign-in, the business). Decorative; the page says it all in words.
 */
export function AgentScene({ agent, person }: { agent: AgentIdentity; person?: { name: string; detail: string; lines: { text: string; ok: boolean }[] } }) {
  return (
    <div className={styles.panel} aria-hidden="true" data-testid="agent-scene">
      <div className={styles.stack}>
        <div className={styles.card}>
          <div className="flex items-center gap-2.5">
            <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${agent.verified ? "bg-info-bg text-primary" : "bg-surface-sunken text-on-surface-muted"}`}>
              <Bot size={16} />
            </span>
            <span className="min-w-0">
              <b className="block truncate text-[14px] font-semibold text-on-surface">{agent.verified ? agent.name : agent.host}</b>
              <small className="block text-[12px] text-on-surface-muted">{agent.verified ? agent.host : t("oauth.scene.unverifiedName")}</small>
            </span>
          </div>
        </div>
        <span className={styles.line} style={{ height: 150 }} />
        <SpineLogo variant="mark" size={48} decorative />
        <span className={styles.line} style={{ height: 70 }} />
        <div className={styles.card}>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-on-surface-muted">
              <Building2 size={16} />
            </span>
            <span className="min-w-0">
              <b className="block truncate text-[14px] font-semibold text-on-surface">{person?.name ?? t("oauth.scene.yourSpine")}</b>
              <small className="block text-[12px] text-on-surface-muted">{person?.detail ?? t("oauth.scene.logInToContinue")}</small>
            </span>
          </div>
          {person && (
            <div className="mt-2.5 flex flex-col gap-1.5">
              {person.lines.map((l) => (
                <span key={l.text} className={`flex items-center gap-2 text-[12px] font-medium ${l.ok ? "text-on-surface" : "text-on-surface-muted"}`}>
                  {l.ok ? <CircleCheck size={13} className="text-paid" /> : <Ban size={13} />}
                  {l.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className={styles.caption}>
        <b className="block text-[18px] font-semibold leading-snug text-on-surface">{t("oauth.scene.captionTitle")}</b>
        <span className="mt-1 block text-[13px] text-on-surface-muted">{t("oauth.scene.captionBody")}</span>
      </div>
    </div>
  );
}
