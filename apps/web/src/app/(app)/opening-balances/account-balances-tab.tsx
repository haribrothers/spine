"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, DatePicker, MoneyInput, Spinner, StatCard, StatusChip, ScrollX } from "@spine/ui";
import { OPENING_ADJUSTMENT_NOTE, dayBefore, type OpeningBalanceAccountRow, type OpeningBalancesView } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { t, useT } from "../../../lib/i18n";
import { formatMoney, orgLocaleTag } from "../../../lib/money";

const TYPE_LABELS: Record<OpeningBalanceAccountRow["type"], string> = {
  asset: t("openingBalances.accounts.typeAsset"),
  liability: t("openingBalances.accounts.typeLiability"),
  equity: t("openingBalances.accounts.typeEquity"),
  income: t("openingBalances.accounts.typeIncome"),
  expense: t("openingBalances.accounts.typeExpense"),
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric", year: "numeric" });

type Entered = Record<string, { debit: bigint; credit: bigint }>;

/**
 * US-RPT-16 (D-137) — the cutover date and every account's balance on it.
 * Receivables, retention, payables and customer advances are read-only:
 * they come from opening documents. Debits and credits needn't match: the
 * difference sits in Opening Balance Adjustments.
 */
export function AccountBalancesTab({ view, currency, onSaved }: { view: OpeningBalancesView; currency: string; onSaved: (view: OpeningBalancesView) => void }) {
  const t = useT();
  const locked = view.status === "locked";
  const [cutover, setCutover] = useState(view.cutoverDate);
  const [entered, setEntered] = useState<Entered>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCutover(view.cutoverDate);
    setEntered(Object.fromEntries(view.accounts.filter((a) => !a.fromDocuments).map((a) => [a.accountId, { debit: BigInt(a.debit), credit: BigInt(a.credit) }])));
  }, [view]);

  const money = (v: bigint | string) => formatMoney(BigInt(v), currency);
  const { debits, credits } = useMemo(() => {
    let d = 0n;
    let c = 0n;
    for (const a of view.accounts) {
      if (a.fromDocuments) {
        d += BigInt(a.fromDocuments.debit);
        c += BigInt(a.fromDocuments.credit);
      } else {
        d += entered[a.accountId]?.debit ?? 0n;
        c += entered[a.accountId]?.credit ?? 0n;
      }
    }
    return { debits: d, credits: c };
  }, [view.accounts, entered]);
  const adjustment = debits - credits;

  function set(accountId: string, side: "debit" | "credit", value: bigint) {
    setSaved(false);
    // An account has a debit or a credit balance, not both.
    setEntered((e) => ({ ...e, [accountId]: side === "debit" ? { debit: value, credit: value > 0n ? 0n : (e[accountId]?.credit ?? 0n) } : { credit: value, debit: value > 0n ? 0n : (e[accountId]?.debit ?? 0n) } }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const lines = Object.entries(entered)
        .filter(([, v]) => v.debit > 0n || v.credit > 0n)
        .map(([accountId, v]) => ({ accountId, debit: v.debit.toString(), credit: v.credit.toString() }));
      onSaved(await apiClient.put<OpeningBalancesView>("/opening-balances", { cutoverDate: cutover, lines }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("openingBalances.accounts.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const groups = (["asset", "liability", "equity", "income", "expense"] as const).map((type) => ({ type, rows: view.accounts.filter((a) => a.type === type) })).filter((g) => g.rows.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("openingBalances.accounts.cutoverDate")} value={day(cutover)} trend={{ direction: "neutral", label: t("openingBalances.accounts.balancesAsOf", { date: day(dayBefore(cutover)) }) }} />
        <StatCard label={t("openingBalances.accounts.debits")} value={money(debits)} />
        <StatCard label={t("openingBalances.accounts.credits")} value={money(credits)} />
        <div className="rounded-lg border border-border bg-surface p-5" data-testid="opening-adjustment">
          <p className="text-[14px] font-medium text-on-surface">{t("openingBalances.common.adjustments")}</p>
          <p className={`mt-2 text-[28px] font-semibold tabular-nums ${adjustment === 0n ? "text-paid" : "text-due-soon"}`}>{money(adjustment < 0n ? -adjustment : adjustment)}</p>
          <p className="mt-1 text-[13px] text-on-surface-muted">{adjustment === 0n ? t("openingBalances.common.nothingLeft") : t("openingBalances.common.notBalanced")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <DatePicker
            value={new Date(`${cutover}T00:00:00`)}
            onChange={(d) => {
              if (!d) return;
              setSaved(false);
              setCutover(iso(d));
            }}
            disabled={locked}
          />
        </div>
        {locked ? <StatusChip status="paid">{t("openingBalances.common.locked")}</StatusChip> : <StatusChip status="due-soon">{t("openingBalances.accounts.draft")}</StatusChip>}
        {!locked && (
          <Button className="ml-auto" onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : t("openingBalances.accounts.save")}
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert variant="success">
          <AlertDescription>{t("openingBalances.accounts.saved", { date: day(dayBefore(cutover)) })}</AlertDescription>
        </Alert>
      )}

      <ScrollX label={t("ui.scrollX.label")} className="rounded-lg border border-border bg-surface">
        <table className="w-full text-[14px]" data-testid="opening-grid">
          <thead>
            <tr className="border-b border-border text-left text-on-surface-muted">
              <th className="px-4 py-3 font-medium">{t("openingBalances.common.colCode")}</th>
              <th className="px-4 py-3 font-medium">{t("openingBalances.common.colAccount")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("openingBalances.common.colDebit")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("openingBalances.common.colCredit")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.type}>
                <tr className="bg-surface-sunken">
                  <th colSpan={4} scope="colgroup" className="px-4 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-on-surface-muted">
                    {TYPE_LABELS[g.type]}
                  </th>
                </tr>
                {g.rows.map((a) => {
                  const docs = a.fromDocuments;
                  const value = entered[a.accountId] ?? { debit: 0n, credit: 0n };
                  return (
                    <tr key={a.accountId} className="border-b border-border last:border-0" data-testid="opening-row">
                      <td className="px-4 py-2 tabular-nums text-on-surface">{a.code}</td>
                      <td className="px-4 py-2 text-on-surface">{a.name}</td>
                      {docs ? (
                        <>
                          <td className="px-4 py-2 text-right text-[13px] text-on-surface-muted">{BigInt(docs.credit) === 0n ? `${docs.label} · ${money(docs.debit)}` : ""}</td>
                          <td className="px-4 py-2 text-right text-[13px] text-on-surface-muted">{BigInt(docs.credit) > 0n ? `${docs.label} · ${money(docs.credit)}` : ""}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2">
                            <div className="ml-auto w-36">
                              <MoneyInput aria-label={t("openingBalances.accounts.debitAria", { name: a.name })} value={value.debit} onValueChange={(v) => set(a.accountId, "debit", v)} currency={currency} disabled={locked} />
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="ml-auto w-36">
                              <MoneyInput aria-label={t("openingBalances.accounts.creditAria", { name: a.name })} value={value.credit} onValueChange={(v) => set(a.accountId, "credit", v)} currency={currency} disabled={locked} />
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-strong font-semibold text-on-surface">
              <td />
              <td className="px-4 py-3">{t("openingBalances.common.totals")}</td>
              <td className="px-4 py-3 text-right tabular-nums">{money(debits)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{money(credits)}</td>
            </tr>
          </tfoot>
        </table>
      </ScrollX>
      {adjustment !== 0n && (
        <Alert variant="warning">
          <AlertDescription>
            {t("openingBalances.accounts.adjustmentNote", {
              amount: money(adjustment < 0n ? -adjustment : adjustment),
              note: OPENING_ADJUSTMENT_NOTE.charAt(0).toLowerCase() + OPENING_ADJUSTMENT_NOTE.slice(1),
            })}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
