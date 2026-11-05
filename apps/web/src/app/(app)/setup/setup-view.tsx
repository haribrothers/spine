"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, Badge, Button, Card, CardContent, Progress, Spinner, StatCard, cn } from "@spine/ui";
import {
  BACKUPS_NOT_TRACKED_NOTE,
  FEATURE_FLAGS,
  SELF_HOSTING_GUIDE_URL,
  SETUP_CARDS,
  SETUP_DEMO_NOTE,
  setupProgress,
  type SetupCardStatus,
  type SetupStatus,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { SettingsDialog } from "../../../components/settings-dialog";
import { useT } from "../../../lib/i18n";

/**
 * US-ONB-15, US-ONB-16 (D-155, D-194) — one card per setup step, "Done" or
 * "To do" as the business's own data says. "Set up" / "Review" opens the
 * Settings pane over this page (closing it comes back here, with the cards
 * re-read), or the Banking, Opening balances or Users page. Email sending
 * and Backups are set by whoever runs the server, so they link to the
 * self-hosting guide. "How it works" waits for the bundled guide (US-SITE-11).
 */
export function SetupView() {
  const t = useT();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient
      .get<SetupStatus>("/org/setup-status")
      .then((s) => {
        setStatus(s);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("setup.view.loadFailed")));
  }, []);
  useEffect(load, [load]);

  async function setHidden(key: string, hidden: boolean) {
    setSaving(key);
    try {
      setStatus(await apiClient.put<SetupStatus>(`/org/setup-status/${key}/hidden`, { hidden }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("setup.view.saveFailed"));
    } finally {
      setSaving(null);
    }
  }

  if (error && !status) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!status) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const progress = setupProgress(status.cards);
  const shown = status.cards.filter((c) => !c.hidden);
  const hidden = status.cards.filter((c) => c.hidden);

  return (
    <div className="flex flex-col gap-6">
      {status.demoLoaded && (
        <Alert variant="info">
          <AlertDescription>{SETUP_DEMO_NOTE}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("setup.view.done")} value={t("setup.view.doneOfTotal", { done: progress.done, total: progress.total })} data-testid="setup-done" />
        <StatCard label={t("setup.view.toDo")} value={String(progress.toDo)} />
        <StatCard label={t("setup.view.notNeeded")} value={String(progress.notNeeded)} />
      </div>
      <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} aria-label={t("setup.view.progressLabel", { done: progress.done, total: progress.total })} />

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={t("setup.view.stepsLabel")}>
        {shown.map((card) => (
          <SetupCard key={card.key} card={card} saving={saving === card.key} onOpenPane={setPane} onHide={() => void setHidden(card.key, true)} />
        ))}
      </ul>

      {hidden.length > 0 && (
        <section className="flex flex-col gap-2" aria-label={t("setup.view.notNeeded")}>
          <h2 className="text-[13px] font-semibold text-on-surface">{t("setup.view.notNeeded")}</h2>
          <ul className="flex flex-col gap-2">
            {hidden.map((card) => (
              <li key={card.key} className="flex min-h-11 items-center justify-between gap-4 rounded-md border border-border bg-surface px-4 py-2">
                <span className="text-[13px] text-on-surface-muted">{SETUP_CARDS[card.key].title}</span>
                <Button variant="ghost" size="sm" disabled={saving === card.key} onClick={() => void setHidden(card.key, false)}>
                  {t("setup.view.showAgain")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SettingsDialog
        open={pane !== null}
        onOpenChange={(open) => {
          if (open) return;
          setPane(null);
          load();
        }}
        isOwner
        initialKey={pane}
      />
    </div>
  );
}

function SetupCard({ card, saving, onOpenPane, onHide }: { card: SetupCardStatus; saving: boolean; onOpenPane: (pane: string) => void; onHide: () => void }) {
  const t = useT();
  const def = SETUP_CARDS[card.key];
  const label = card.done ? t("setup.card.review") : t("setup.card.setUp");
  const variant = card.done ? "secondary" : "primary";
  const action =
    "settings" in def.target ? (
      <Button variant={variant} size="sm" onClick={() => onOpenPane((def.target as { settings: string }).settings)}>
        {label}
      </Button>
    ) : "page" in def.target ? (
      <Button asChild variant={variant} size="sm">
        <Link href={def.target.page}>{label}</Link>
      </Button>
    ) : (
      <Button asChild variant={card.done ? "secondary" : "primary"} size="sm">
        <a href={SELF_HOSTING_GUIDE_URL} target="_blank" rel="noreferrer">
          {t("setup.card.readGuide")}
        </a>
      </Button>
    );

  return (
    <li>
      <Card className="h-full" data-testid={`setup-card-${card.key}`}>
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-on-surface">{def.title}</h2>
            {card.done !== null && (
              <Badge className={cn(card.done ? "bg-category-green-bg text-category-green" : "bg-category-amber-bg text-category-amber")}>{card.done ? t("setup.view.done") : t("setup.view.toDo")}</Badge>
            )}
          </div>
          <p className="flex-1 text-[13px] text-on-surface-muted">{def.why}</p>
          {card.done === null && <p className="text-[13px] text-on-surface-muted">{BACKUPS_NOT_TRACKED_NOTE}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {action}
            {FEATURE_FLAGS.bundledHelp && (
              <a href={def.guide} target="_blank" rel="noreferrer" className="text-[13px] text-primary hover:underline">
                {t("setup.card.howItWorks")}
              </a>
            )}
            <Button variant="ghost" size="sm" className="ml-auto" disabled={saving} onClick={onHide}>
              {t("setup.card.markNotNeeded")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
