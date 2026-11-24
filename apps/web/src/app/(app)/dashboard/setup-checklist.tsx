"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, cn } from "@spine/ui";
import { finishSettingUpLabel } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { t as translate, useT } from "../../../lib/i18n";

interface ChecklistStatus {
  /** False for Staff and Field: setup is the Owner's job (US-ONB-12). */
  visible: boolean;
  hasCustomer: boolean;
  hasItem: boolean;
  hasSentQuote: boolean;
  dismissed: boolean;
  /** US-ONB-15 — setup cards still to do on Set up Spine. */
  setupLeft?: number;
}

const CHECKLIST_ITEMS: { key: "hasCustomer" | "hasItem" | "hasSentQuote"; label: string; href: string }[] = [
  { key: "hasCustomer", label: translate("dashboard.checklist.addCustomer"), href: "/contacts" },
  { key: "hasItem", label: translate("dashboard.checklist.createItem"), href: "/catalog" },
  { key: "hasSentQuote", label: translate("dashboard.checklist.sendQuote"), href: "/quotes" },
];

/**
 * Persistent, dismissible setup checklist (S-12.9). Wired to real
 * completion checks via `GET /dashboard/checklist` — one call returns both
 * the three completion flags and the persisted dismissed state, so a
 * failure of the single request has one obvious fallback (render nothing
 * further, per the `error` state below) rather than two separately-timed
 * fetches whose failure/success combinations multiply. Demo-seeded data
 * doesn't count toward any item (see `DashboardService`'s own comment) —
 * this is asking "have you done this for real," not "does data exist."
 *
 * Dismissal writes through `POST /dashboard/checklist/dismiss`, not
 * `PUT /org/settings/:key` — that route is owner-only, but every org
 * member sees and can dismiss this checklist (see
 * `DashboardService.dismissChecklist`'s comment).
 *
 * Once all three are checked, the card says "Finish setting up Spine —
 * <n> left" and links to Set up Spine (US-ONB-15) until every setup card is
 * done or marked not needed; then it auto-dismisses (persisted, same as the
 * manual Dismiss action) rather than leaving a fully-ticked card sitting on
 * the dashboard forever. Guarded by `autoDismissSent` so a remount while the
 * write is still in flight (or already succeeded but the fetched
 * `dismissed` hasn't caught up yet) doesn't fire a redundant PUT per visit.
 */
export function SetupChecklist({ className, onVisibleChange }: { className?: string; /** US-DASH-16: the dashboard moves Today when the checklist takes its spot. */ onVisibleChange?: (visible: boolean) => void } = {}) {
  const t = useT();
  const [status, setStatus] = useState<ChecklistStatus | null>(null);
  const [error, setError] = useState(false);
  const autoDismissSent = useRef(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<ChecklistStatus>("/dashboard/checklist")
      .then((res) => {
        if (cancelled) return;
        setStatus(res);
        const allDone = res.hasCustomer && res.hasItem && res.hasSentQuote && (res.setupLeft ?? 0) === 0;
        if (allDone && !res.dismissed && !autoDismissSent.current) {
          autoDismissSent.current = true;
          apiClient.post("/dashboard/checklist/dismiss").catch((err) => {
            autoDismissSent.current = false;
            console.error("Failed to auto-dismiss setup checklist", err);
          });
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDismiss() {
    setStatus((current) => (current ? { ...current, dismissed: true } : current));
    try {
      await apiClient.post("/dashboard/checklist/dismiss");
    } catch (err) {
      console.error("Failed to dismiss setup checklist", err);
    }
  }

  const shown = !error && status !== null && status.visible && !status.dismissed;
  useEffect(() => {
    onVisibleChange?.(shown);
  }, [shown, onVisibleChange]);

  // Nothing until the status is known, so the dashboard doesn't shuffle cards.
  if (!shown || !status) return null;

  const firstStepsDone = status.hasCustomer && status.hasItem && status.hasSentQuote;
  if (firstStepsDone) {
    const left = status.setupLeft ?? 0;
    if (left === 0) return null;
    return (
      <Card className={cn("w-full", className)} data-testid="finish-setting-up">
        <CardHeader>
          <CardTitle>{finishSettingUpLabel(left)}</CardTitle>
          <CardDescription>{t("dashboard.checklist.finishDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button asChild size="sm">
            <Link href="/setup">{t("dashboard.checklist.setUp")}</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            {t("dashboard.checklist.dismiss")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>{t("dashboard.checklist.getStarted")}</CardTitle>
        <CardDescription>{t("dashboard.checklist.getStartedDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {CHECKLIST_ITEMS.map((item) => {
            const done = status[item.key];
            return (
              <li key={item.key} className="flex items-center gap-2 text-[13px] text-on-surface">
                <Checkbox checked={done} disabled aria-label={done ? t("dashboard.checklist.itemDone", { label: item.label }) : item.label} />
                {done ? <span className="text-on-surface-muted line-through">{item.label}</span> : <Link href={item.href}>{item.label}</Link>}
              </li>
            );
          })}
        </ul>
        <Button variant="ghost" size="sm" className="self-start" onClick={handleDismiss}>
          {t("dashboard.checklist.dismiss")}
        </Button>
      </CardContent>
    </Card>
  );
}
