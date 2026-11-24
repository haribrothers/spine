"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DatePicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { apiClient, ApiError } from "../../../lib/api-client";
import { SavedToast } from "../saved-toast";
import { ChartOfAccountsStep, type AccountsByType } from "../../onboarding/steps/chart-of-accounts-step";
import { useT } from "../../../lib/i18n";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;

interface FiscalPeriod {
  id: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

/**
 * S-10.1's chart-of-accounts half, plus S-09.9 (add a custom account) and
 * S-09.8 (close a fiscal period) — folded into this same pane rather than
 * given their own Settings tabs, since both are chart-of-accounts-adjacent
 * financial administration an Owner reaches for right after reviewing the
 * CoA list, and Settings' own tab list is already fairly long.
 *
 * Relocated from the old routed `settings/accounts/page.tsx` — content/logic unchanged.
 */
export function AccountsPane() {
  const t = useT();
  const [accounts, setAccounts] = useState<AccountsByType | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  function loadAccounts() {
    apiClient.get<AccountsByType>("/org/accounts").then(setAccounts);
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  if (!accounts) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-[15px] font-semibold text-on-surface">{t("settings.accounts.title")}</h2>
            <p className="text-[13px] text-on-surface-muted">{t("settings.accounts.description")}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
            {t("settings.accounts.addAccount")}
          </Button>
        </div>
        <ChartOfAccountsStep
          accounts={accounts}
          onRename={async (accountId, name) => {
            await apiClient.put(`/org/accounts/${accountId}`, { name });
            setAccounts((prev) => {
              if (!prev) return prev;
              const next: AccountsByType = {};
              for (const [type, rows] of Object.entries(prev)) {
                next[type] = rows.map((row) => (row.id === accountId ? { ...row, name } : row));
              }
              return next;
            });
          }}
          // Renames save as they're made; "Save" just confirms it (US-SET-14).
          onContinue={() => setSaved(true)}
          saveLabel={t("settings.common.save")}
        />
        <SavedToast open={saved} onOpenChange={setSaved} />
      </div>

      <PeriodCloseSection />

      {addOpen && (
        <AddAccountDialog
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            loadAccounts();
          }}
        />
      )}
    </div>
  );
}

function AddAccountDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]>("expense");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/org/accounts", { code, name, type });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.accounts.createError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("settings.accounts.addAccount")}</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="flex flex-col gap-3 pt-2 text-left">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-account-code">{t("settings.accounts.code")}</Label>
                <Input id="new-account-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("settings.accounts.codePlaceholder")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-account-name">{t("settings.accounts.name")}</Label>
                <Input id="new-account-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("settings.accounts.namePlaceholder")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-account-type">{t("settings.accounts.type")}</Label>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger id="new-account-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((accountType) => (
                      <SelectItem key={accountType} value={accountType}>
                        {t(`settings.accounts.types.${accountType}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-[13px] text-overdue">{error}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{t("settings.accounts.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={submit} disabled={saving || !code.trim() || !name.trim()}>
            {saving ? <Spinner size="sm" /> : t("settings.accounts.addAccount")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * S-09.8 — "close a period so nobody back-dates entries into it." A closed
 * period blocks every new journal posting whose date falls inside it (see
 * `LedgerService.postEntry`'s own guard) — since every document posts at
 * issue/record/approve time (not a user-chosen backdate field), closing
 * the CURRENT period is the practical way to freeze the books; closing a
 * genuinely past range mainly documents "this period is filed" since
 * nothing new would post into the past anyway.
 */
function PeriodCloseSection() {
  const t = useT();
  const [periods, setPeriods] = useState<FiscalPeriod[] | null>(null);
  const [startDate, setStartDate] = useState<Date>(startOfMonth());
  const [endDate, setEndDate] = useState<Date>(endOfMonth());
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiClient
      .get<FiscalPeriod[]>("/org/fiscal-periods")
      .then(setPeriods)
      .catch((err) => setError(err instanceof ApiError && err.status === 403 ? t("settings.accounts.ownerOnly") : t("settings.accounts.periodsLoadError")));
  }

  useEffect(() => {
    load();
  }, []);

  async function createPeriod() {
    setCreating(true);
    setError(null);
    try {
      await apiClient.post("/org/fiscal-periods", { startDate: toDateParam(startDate), endDate: toDateParam(endDate) });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.accounts.periodCreateError"));
    } finally {
      setCreating(false);
    }
  }

  async function toggleClose(period: FiscalPeriod) {
    setBusyId(period.id);
    try {
      await apiClient.post(`/org/fiscal-periods/${period.id}/${period.isClosed ? "reopen" : "close"}`, {});
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted">{t("settings.accounts.periodClose")}</h3>
        <p className="text-[13px] text-on-surface-muted">
          {t("settings.accounts.periodCloseDescription")}
        </p>
      </div>

      {error && <p className="text-[13px] text-overdue">{error}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label>{t("settings.accounts.start")}</Label>
          <DatePicker value={startDate} onChange={setStartDate} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("settings.accounts.end")}</Label>
          <DatePicker value={endDate} onChange={setEndDate} />
        </div>
        <Button size="sm" onClick={createPeriod} disabled={creating}>
          {creating ? <Spinner size="sm" /> : t("settings.accounts.addPeriod")}
        </Button>
      </div>

      {periods && periods.length > 0 && (
        <div className="rounded-md border border-border-strong bg-surface">
          {periods.map((period) => (
            <div key={period.id} className="flex items-center justify-between border-b border-border px-3 py-2 text-[13px] last:border-b-0">
              <span className="text-on-surface">
                {period.startDate} — {period.endDate}
              </span>
              <div className="flex items-center gap-2">
                <span className={period.isClosed ? "text-overdue" : "text-on-surface-muted"}>{period.isClosed ? t("settings.accounts.closed") : t("settings.accounts.open")}</span>
                <Button size="sm" variant="ghost" onClick={() => toggleClose(period)} disabled={busyId === period.id}>
                  {busyId === period.id ? <Spinner size="sm" /> : period.isClosed ? t("settings.accounts.reopen") : t("settings.accounts.close")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function toDateParam(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
