"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, Spinner, useConfirm } from "@spine/ui";
import type { BankEntryDetails, BankTransaction, BankTransfer } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { AttachmentsSection } from "../../../components/attachments-section";
import { formatDay } from "./dates";

import { SectionLink } from "../../../components/section-link";
export type DrawerEntry = { kind: "bank_transaction" | "bank_transfer"; id: string; what: string };
type Loaded = { kind: "bank_transaction"; entry: BankTransaction & BankEntryDetails } | { kind: "bank_transfer"; entry: BankTransfer & BankEntryDetails };

/**
 * US-BANK-14 (D-231) — `RegisterEntryDrawer`: a money in or out entry, or a
 * transfer, has no page of its own, so the register opens it here — its
 * date, account (or From and To), category, tax, contact, reference,
 * description, amount, whether it's reconciled and its files — with Delete
 * entry, which asks first and isn't offered once it's reconciled.
 */
export function RegisterEntryDrawer({
  entry,
  currency,
  canDelete,
  onOpenChange,
  onDeleted,
}: {
  entry: DrawerEntry | null;
  currency: string;
  canDelete: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (kind: DrawerEntry["kind"]) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    setLoaded(null);
    setError(null);
    if (!entry) return;
    const path = entry.kind === "bank_transaction" ? `/bank-transactions/${entry.id}` : `/bank-transfers/${entry.id}`;
    apiClient
      .get<(BankTransaction | BankTransfer) & BankEntryDetails>(path)
      .then((res) => setLoaded({ kind: entry.kind, entry: res } as Loaded))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this entry."));
  }, [entry]);

  const money = (v: string) => formatMoney(BigInt(v), currency);
  const isTransfer = loaded?.kind === "bank_transfer";

  async function remove() {
    if (!entry || !loaded) return;
    const ok = await confirm({
      title: isTransfer ? "Delete this transfer?" : "Delete this entry?",
      description: isTransfer
        ? "Spine posts a reversing entry today, so both accounts go back to their balances before it. The transfer stays in both registers, marked deleted."
        : "Spine posts a reversing entry today, so the account goes back to its balance before it. The entry stays in the register, marked deleted.",
      confirmLabel: isTransfer ? "Delete transfer" : "Delete entry",
      cancelLabel: isTransfer ? "Keep transfer" : "Keep entry",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiClient.delete(isTransfer ? `/bank-transfers/${entry.id}` : `/bank-transactions/${entry.id}`);
      onDeleted(entry.kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this entry. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const rows: [string, React.ReactNode][] = [];
  if (loaded?.kind === "bank_transaction") {
    const e = loaded.entry;
    rows.push(["Amount", <b key="a" className="text-[18px] tabular-nums">{money(e.amount)}</b>]);
    rows.push([e.direction === "in" ? "Into" : "From", e.moneyAccount.name]);
    rows.push(["Category", `${e.account.code} · ${e.account.name}`]);
    if (BigInt(e.taxAmount) > 0n) rows.push(["Tax", `${e.taxName ?? "Tax"} · ${money(e.taxAmount)} included`]);
    rows.push([
      "Contact",
      e.contact ? (
        <SectionLink key="c" href={`/contacts/${e.contact.id}`} className="text-primary hover:underline">
          {e.contact.name}
        </SectionLink>
      ) : (
        "—"
      ),
    ]);
    rows.push(["Description", e.description ?? "—"]);
  } else if (loaded?.kind === "bank_transfer") {
    const e = loaded.entry;
    rows.push(["Amount", <b key="a" className="text-[18px] tabular-nums">{money(e.amount)}</b>]);
    rows.push(["From", e.fromMoneyAccount.name]);
    rows.push(["To", e.toMoneyAccount.name]);
    rows.push(["Reference", e.reference ?? "—"]);
  }
  if (loaded) rows.push(["Reconciled", loaded.entry.reconciled ? "Yes — it's part of a finished reconciliation" : <span key="r" className="text-on-surface-muted">Not yet</span>]);

  const deleted = Boolean(loaded?.entry.deletedAt);
  return (
    <Drawer open={entry !== null} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{entry?.what}</DrawerTitle>
          <DrawerDescription>
            {loaded ? [formatDay(loaded.entry.date), loaded.entry.createdBy ? `recorded by ${loaded.entry.createdBy}` : null, deleted ? "deleted" : null].filter(Boolean).join(" · ") : " "}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-5" data-testid="register-entry-drawer">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!loaded && !error ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-[14px]">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-on-surface-muted">{k}</dt>
                  <dd className="text-on-surface">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {loaded?.kind === "bank_transaction" && entry && <AttachmentsSection entityType="bank_transaction" entityId={entry.id} />}
          {loaded && canDelete && !deleted && !loaded.entry.reconciled && (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-[12.5px] text-on-surface-muted">Deleting posts a reversing entry today.</span>
              <Button variant="danger" onClick={() => void remove()} disabled={busy}>
                <MENU_ICONS.delete size={14} aria-hidden />
                {isTransfer ? "Delete transfer" : "Delete entry"}
              </Button>
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
      {dialog}
    </Drawer>
  );
}
