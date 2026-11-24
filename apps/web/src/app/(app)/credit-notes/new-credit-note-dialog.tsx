"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Spinner, cn } from "@spine/ui";
import { Search } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { calendarDate } from "../quotes/quotes-list-state";
import type { Invoice } from "../invoices/types";
import { useT } from "../../../lib/i18n";

/**
 * US-INV-37 (D-219) — "New credit note" from the credit notes list: which
 * invoice does it correct? Issued invoices (not deposits or opening
 * balances) with something left to credit, searched by number, customer or
 * job; Continue opens the issue dialog for the one picked.
 */
export function NewCreditNoteDialog({ open, onOpenChange, onPicked }: { open: boolean; onOpenChange: (open: boolean) => void; onPicked: (invoice: Invoice) => void }) {
  const t = useT();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setPicked(null);
    setInvoices(null);
    apiClient
      .get<Invoice[]>("/invoices?picker=1")
      .then((list) => setInvoices(list.filter((i) => i.status === "issued" && i.type !== "advance" && i.type !== "opening" && BigInt(i.leftToCredit ?? "0") > 0n)))
      .catch(() => setInvoices([]));
  }, [open]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (invoices ?? []).filter((i) => !needle || [i.number ?? "", i.contactName ?? "", i.job?.number ?? "", i.job?.name ?? ""].some((f) => f.toLowerCase().includes(needle))).slice(0, 8);
  }, [invoices, q]);
  const today = new Date();
  const chosen = invoices?.find((i) => i.id === picked) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("creditNotes.newDialog.title")}</DialogTitle>
          <DialogDescription>{t("creditNotes.newDialog.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
            <Input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("creditNotes.newDialog.searchPlaceholder")} aria-label={t("creditNotes.newDialog.searchAria")} className="pl-9" />
          </div>
          {!invoices ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : shown.length === 0 ? (
            <p className="py-2 text-[13px] text-on-surface-muted">{q.trim() ? t("creditNotes.newDialog.noMatch", { q: q.trim() }) : t("creditNotes.newDialog.noneLeft")}</p>
          ) : (
            <div role="listbox" aria-label={t("creditNotes.newDialog.listAria")} className="overflow-hidden rounded-md border border-border">
              {shown.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  role="option"
                  aria-selected={picked === inv.id}
                  onClick={() => setPicked(inv.id)}
                  onDoubleClick={() => onPicked(inv)}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-t border-border px-3 py-2.5 text-left first:border-t-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                    picked === inv.id ? "bg-info-bg" : "hover:bg-surface-sunken",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-on-surface">{inv.number}</span>
                    <span className="block truncate text-[12.5px] text-on-surface-muted">
                      {[inv.contactName, inv.issueDate ? t("creditNotes.newDialog.issuedOn", { date: calendarDate(inv.issueDate, today, orgLocaleTag()) }) : null, formatMoney(BigInt(inv.totalAmount), inv.currency)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[12px] text-on-surface-muted">{t("creditNotes.newDialog.leftToCredit")}</span>
                    <span className="block text-[13.5px] tabular-nums text-on-surface">{formatMoney(BigInt(inv.leftToCredit ?? "0"), inv.currency)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("creditNotes.newDialog.cancel")}
          </Button>
          <Button type="button" disabled={!chosen} onClick={() => chosen && onPicked(chosen)}>
            {t("creditNotes.newDialog.continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
