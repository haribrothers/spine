"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useConfirm,
} from "@spine/ui";
import type { QuoteCustomerLink } from "@spine/shared";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { useModule } from "../../../lib/modules-context";
import { MENU_ICONS } from "../../../lib/menu-icons";
import type { Quote } from "./types";
import { t, useT } from "../../../lib/i18n";

/** US-OPS-38 — the toasts for a quote's actions that open another page, shown there (D-223). */
export const QUOTE_TOASTS = {
  revised: (quote: Quote): [string, string] => [
    t("quotes.toasts.revisedTitle", { number: quote.number ?? t("quotes.toasts.quote") }),
    t("quotes.toasts.revisedDescription", { next: quote.version + 1, version: quote.version }),
  ],
  duplicated: (quote: Quote): [string, string] => [t("quotes.toasts.duplicatedTitle"), t("quotes.toasts.duplicatedDescription", { number: quote.number ?? t("quotes.toasts.theQuote") })],
  toInvoice: (quote: Quote): [string, string] => [t("quotes.toasts.toInvoiceTitle", { number: quote.number ?? t("quotes.toasts.quote") }), t("quotes.toasts.toInvoiceDescription")],
  toJob: (quote: Quote, jobNumber: string | null): [string, string] => [
    t("quotes.toasts.toJobTitle", { number: quote.number ?? t("quotes.toasts.quote") }),
    t("quotes.toasts.toJobDescription", { job: jobNumber ?? t("quotes.toasts.theJob") }),
  ],
  deleted: (quote: Quote): [string, string] => [t("quotes.toasts.deletedTitle"), t("quotes.toasts.deletedDescription", { number: quote.number ?? t("quotes.toasts.draftQuote") })],
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** US-QUO-31 — copies a fresh customer link and says so (or shows it when the clipboard is unavailable). */
export async function copyCustomerLink(quoteId: string, notify: (title: string, description: string) => void, fail: (title: string, message: string) => void) {
  try {
    const link = await apiClient.post<QuoteCustomerLink>(`/quotes/${quoteId}/link`);
    try {
      await navigator.clipboard.writeText(link.url);
      notify(t("quotes.toasts.linkCopied"), t("quotes.toasts.linkCopiedDescription"));
    } catch {
      notify(t("quotes.toasts.hereIsLink"), link.url);
    }
  } catch (err) {
    fail(t("quotes.toasts.linkFailed"), err instanceof Error ? err.message : t("quotes.toasts.tryAgain"));
  }
}

/**
 * US-QUO-29 (D-214) — a quote row's menu: what you may do next with it.
 * View; Edit, Send and Delete for a draft; Copy customer link, Email again
 * (on its page) and Revise once sent; Convert to invoice or job once
 * accepted; Download PDF and Duplicate for any. Each only with the right,
 * as the API checks (own/others from `createdByUserId`).
 */
export function QuoteRowActions({
  quote,
  onDeleted,
  onNotify,
  onFailed,
}: {
  quote: Quote;
  onDeleted: (quote: Quote) => void;
  onNotify: (title: string, description: string) => void;
  /** An action failed: shown above the list (US-OPS-38). */
  onFailed: (title: string, message: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canEdit = useCanEditOwnership(quote.createdByUserId, { own: "quotes.edit_own", others: "quotes.edit_others" });
  const canDelete = useCanEditOwnership(quote.createdByUserId, { own: "quotes.delete_own", others: "quotes.delete_others" });
  const canCreate = useCapability("quotes.edit_own");
  const canSend = useCapability("quotes.send");
  const canRevise = useCapability("quotes.revise");
  const canCreateJob = useCapability("jobs.edit_own");
  const jobsOn = useModule("jobsField");
  const draft = quote.status === "draft";
  const current = !quote.isSuperseded;

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/quotes/${quote.id}`);
      setConfirmOpen(false);
      onDeleted(quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("quotes.rowActions.deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function post(path: string, failure: string, done: [string, string]) {
    try {
      const next = await apiClient.post<Quote>(path);
      onNotify(...done);
      router.push(`/quotes/${next.id}`);
    } catch (err) {
      onFailed(failure, err instanceof Error ? err.message : t("quotes.toasts.tryAgain"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("quotes.rowActions.menuLabel", { number: quote.number ?? t("quotes.rowActions.thisDraftQuote") })}
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}`)}>
            <MENU_ICONS.view aria-hidden />
            {t("quotes.rowActions.view")}
          </DropdownMenuItem>
          {draft && canEdit && (
            <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}/edit`)}>
              <MENU_ICONS.edit aria-hidden />
              {t("quotes.rowActions.edit")}
            </DropdownMenuItem>
          )}
          {draft && canSend && (
            <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}?action=send`)}>
              <MENU_ICONS.send aria-hidden />
              {t("quotes.rowActions.send")}
            </DropdownMenuItem>
          )}
          {quote.status === "sent" && current && canSend && (
            <DropdownMenuItem onSelect={() => void copyCustomerLink(quote.id, onNotify, onFailed)}>
              <MENU_ICONS.copyLink aria-hidden />
              {t("quotes.rowActions.copyLink")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <a href={`${API_URL}/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer">
              <MENU_ICONS.download aria-hidden />
              {draft ? t("quotes.rowActions.previewPdf") : t("quotes.rowActions.downloadPdf")}
            </a>
          </DropdownMenuItem>
          {canCreate && (
            <DropdownMenuItem onSelect={() => void post(`/quotes/${quote.id}/duplicate`, t("quotes.rowActions.duplicateFailed"), QUOTE_TOASTS.duplicated(quote))}>
              <MENU_ICONS.duplicate aria-hidden />
              {t("quotes.rowActions.duplicate")}
            </DropdownMenuItem>
          )}
          {quote.status === "accepted" && (
            <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}?action=convert-invoice`)}>
              <MENU_ICONS.convertToInvoice aria-hidden />
              {t("quotes.rowActions.convertToInvoice")}
            </DropdownMenuItem>
          )}
          {quote.status === "accepted" && canCreateJob && jobsOn && (
            <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}?action=convert-job`)}>
              <MENU_ICONS.convertToJob aria-hidden />
              {t("quotes.rowActions.convertToJob")}
            </DropdownMenuItem>
          )}
          {!draft && current && canRevise && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async () => {
                  const ok = await confirm({
                    title: t("quotes.reviseConfirm.title"),
                    description: t("quotes.reviseConfirm.description", { number: quote.number ?? t("quotes.reviseConfirm.thisQuote"), next: quote.version + 1 }),
                    confirmLabel: t("quotes.reviseConfirm.confirm"),
                  });
                  if (ok) void post(`/quotes/${quote.id}/revise`, t("quotes.rowActions.reviseFailed"), QUOTE_TOASTS.revised(quote));
                }}
              >
                <MENU_ICONS.revise aria-hidden />
                {t("quotes.rowActions.revise")}
              </DropdownMenuItem>
            </>
          )}
          {draft && canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
                <MENU_ICONS.delete aria-hidden />
                {t("quotes.rowActions.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("quotes.deleteConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("quotes.deleteConfirm.description")}
              {error && <span className="mt-2 block text-overdue">{error}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("quotes.rowActions.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="danger" disabled={busy} onClick={handleDelete}>
              {t("quotes.rowActions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {confirmDialog}
    </>
  );
}
