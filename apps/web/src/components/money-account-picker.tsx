"use client";

import { useEffect, useState } from "react";
import { FormField, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@spine/ui";
import { MONEY_ACCOUNT_KIND_LABELS, type LastMoneyAccounts, type MoneyAccount, type MoneyAccountForm } from "@spine/shared";
import { apiClient } from "../lib/api-client";
import { useT } from "../lib/i18n";

/**
 * US-BANK-03 (D-140) — "Paid into" / "Paid from" on every form that moves
 * money. Lists the organisation's active bank, cash and card accounts and
 * preselects the one this person used last on this kind of form, else the
 * organisation default. Renders nothing when the accounts can't be listed
 * (Field); the server then uses the default.
 */
export function MoneyAccountPicker({
  form,
  direction,
  value,
  onValueChange,
  initialId,
}: {
  form: MoneyAccountForm;
  direction: "in" | "out";
  value: string;
  onValueChange: (id: string) => void;
  /** Start on this account instead (e.g. the one an expense already carries). */
  initialId?: string | null;
}) {
  const t = useT();
  const [accounts, setAccounts] = useState<MoneyAccount[] | null>(null);
  const [lastUsedId, setLastUsedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiClient.get<MoneyAccount[]>("/money-accounts"), apiClient.get<LastMoneyAccounts>("/money-accounts/last-used").catch(() => ({}) as LastMoneyAccounts)])
      .then(([list, last]) => {
        if (cancelled) return;
        setAccounts(list);
        const lastId = last[form] && list.some((a) => a.id === last[form]) ? last[form]! : null;
        setLastUsedId(lastId);
        const start = (initialId && list.some((a) => a.id === initialId) ? initialId : null) ?? lastId ?? list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? "";
        if (start) onValueChange(start);
      })
      .catch(() => setAccounts([]));
    return () => {
      cancelled = true;
    };
    // Load once per mount (the parent's dialog remounts it on reopen); onValueChange is a setter.
  }, [form, initialId]);

  if (accounts !== null && accounts.length === 0) return null;

  const label = direction === "in" ? t("banking.picker.paidInto") : t("banking.picker.paidFrom");
  const selected = accounts?.find((a) => a.id === value);
  const helper = !selected
    ? undefined
    : value === lastUsedId
      ? direction === "in"
        ? t("banking.picker.lastUsedIn")
        : t("banking.picker.lastUsedOut")
      : selected.isDefault
        ? direction === "in"
          ? t("banking.picker.defaultIn")
          : t("banking.picker.defaultOut")
        : undefined;

  return (
    <FormField label={label} required helperText={helper}>
      {(field) => (
        <Select value={value} onValueChange={onValueChange} disabled={!accounts}>
          <SelectTrigger id={field.id} aria-describedby={field["aria-describedby"]}>
            <SelectValue placeholder={t("banking.picker.loading")} />
          </SelectTrigger>
          <SelectContent>
            {(accounts ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
                {a.kind !== "bank" ? ` · ${MONEY_ACCOUNT_KIND_LABELS[a.kind]}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}

/** The account a recorded payment or approved expense used, read-only beside its method. */
export function MoneyAccountLine({ direction, account }: { direction: "in" | "out"; account: { name: string } | null | undefined }) {
  const t = useT();
  if (!account) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px] font-medium text-on-surface-muted">{direction === "in" ? t("banking.picker.paidInto") : t("banking.picker.paidFrom")}</span>
      <span className="text-[14px] text-on-surface">{account.name}</span>
    </div>
  );
}
