"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";

interface ChecklistStatus {
  /** False for Staff and Field: setup is the Owner's job (US-ONB-12). */
  visible: boolean;
  hasCustomer: boolean;
  hasItem: boolean;
  hasSentQuote: boolean;
  dismissed: boolean;
}

const CHECKLIST_ITEMS: { key: keyof Omit<ChecklistStatus, "dismissed" | "visible">; label: string; href: string }[] = [
  { key: "hasCustomer", label: "Add your first customer", href: "/contacts" },
  { key: "hasItem", label: "Create your first item", href: "/catalog" },
  { key: "hasSentQuote", label: "Send your first quote", href: "/quotes" },
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
 * All three checked auto-dismisses (persisted, same as the manual Dismiss
 * action) rather than leaving a fully-ticked card sitting on the
 * dashboard forever. Guarded by `autoDismissSent` so a remount while the
 * write is still in flight (or already succeeded but the fetched
 * `dismissed` hasn't caught up yet) doesn't fire a redundant PUT per visit.
 */
export function SetupChecklist() {
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
        const allDone = res.hasCustomer && res.hasItem && res.hasSentQuote;
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

  if (error) return null;
  if (status && (!status.visible || status.dismissed)) return null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Get started</CardTitle>
        <CardDescription>A few things to do before your first real transaction.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!status ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {CHECKLIST_ITEMS.map((item) => {
              const done = status[item.key];
              return (
                <li key={item.key} className="flex items-center gap-2 text-[13px] text-on-surface">
                  <Checkbox checked={done} disabled />
                  {done ? <span className="text-on-surface-muted line-through">{item.label}</span> : <Link href={item.href}>{item.label}</Link>}
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="ghost" size="sm" className="self-start" onClick={handleDismiss}>
          Dismiss
        </Button>
      </CardContent>
    </Card>
  );
}
