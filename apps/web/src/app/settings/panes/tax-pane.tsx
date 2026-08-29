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
  Checkbox,
  DatePicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  MultiSelect,
  Spinner,
  Switch,
} from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { MoreHorizontal, Plus } from "lucide-react";
import { apiClient, ApiError } from "../../../lib/api-client";
import { SavedToast } from "../saved-toast";

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  isCompound: boolean;
  archivedAt: string | null;
}

interface TaxGroup {
  id: string;
  name: string;
  archivedAt: string | null;
  taxRates: TaxRate[];
}

interface PricesIncludeTaxSetting {
  inclusive: boolean;
}

interface TaxByRateRow {
  name: string;
  percentage: number;
  amount: string;
}

interface TaxSummaryReport {
  from: string;
  to: string;
  taxCollected: string;
  taxPaid: string;
  netTaxPayable: string;
  collectedByRate: TaxByRateRow[];
}

/**
 * PRD FEAT-08 — real named tax rates (S-08.1), rates combined into groups
 * (S-08.3), and the org's price-inclusive-of-tax default (S-08.2). This
 * replaces the earlier Phase 0/1 single-flat-rate onboarding placeholder
 * that used to live here (still readable at `/org/tax/default-rate` for
 * the onboarding wizard's own quick-start step, but no longer the surface
 * a quote/invoice line actually picks from — see quote-line-editor.tsx /
 * invoice-line-editor.tsx, both of which now resolve a real `taxRateId` or
 * `taxGroupId`).
 */
export function TaxPane() {
  const [rates, setRates] = useState<TaxRate[] | null>(null);
  const [groups, setGroups] = useState<TaxGroup[] | null>(null);
  const [inclusive, setInclusive] = useState<PricesIncludeTaxSetting | null>(null);
  const [saved, setSaved] = useState(false);

  async function reload() {
    const [ratesRes, groupsRes, inclusiveRes] = await Promise.all([
      apiClient.get<TaxRate[]>("/tax-rates?includeArchived=true"),
      apiClient.get<TaxGroup[]>("/tax-groups?includeArchived=true"),
      apiClient.get<PricesIncludeTaxSetting>("/org/tax/prices-include-tax"),
    ]);
    setRates(ratesRes);
    setGroups(groupsRes);
    setInclusive(inclusiveRes);
  }

  useEffect(() => {
    void reload();
  }, []);

  if (!rates || !groups || !inclusive) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Tax</h2>
        <p className="text-[13px] text-on-surface-muted">
          Named tax rates, combined into groups for split taxes (e.g. CGST + SGST). A quote, invoice, or catalogue
          item picks one rate or one group per line.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border-strong p-3">
        <div>
          <p className="text-[14px] font-medium text-on-surface">Prices include tax by default</p>
          <p className="text-[13px] text-on-surface-muted">
            New quote/invoice lines default to tax-inclusive pricing. Each line can still override this.
          </p>
        </div>
        <Switch
          checked={inclusive.inclusive}
          onCheckedChange={async (checked) => {
            const next = { inclusive: checked };
            setInclusive(next);
            await apiClient.put("/org/tax/prices-include-tax", next);
            setSaved(true);
          }}
        />
      </div>

      <TaxRatesSection rates={rates} onChanged={reload} onSaved={() => setSaved(true)} />
      <TaxGroupsSection groups={groups} rates={rates.filter((r) => !r.archivedAt)} onChanged={reload} onSaved={() => setSaved(true)} />
      <TaxSummarySection />

      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}

function startOfYear(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1);
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function toDateParam(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * S-08.4 — tax collected/paid/net for a date range, with a per-rate
 * breakdown. Owner-only server-side (`GET /org/tax/summary`); this
 * component renders unconditionally (matching every other pane's "no
 * client-side capability check" convention, see CHANGELOG's own note on
 * that gap) and just shows the API's real 403 error if a Staff user
 * somehow reaches Settings and opens this section.
 */
function TaxSummarySection() {
  const [from, setFrom] = useState<Date>(startOfYear());
  const [to, setTo] = useState<Date>(endOfToday());
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<TaxSummaryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<TaxSummaryReport>(
        `/org/tax/summary?from=${toDateParam(from)}&to=${toDateParam(to)}`,
      );
      setReport(res);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? "Owner-only report." : "Could not load the tax summary.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function money(amount: string) {
    return `${toDecimalString({ amount: BigInt(amount), currency })} ${currency}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted">Tax summary</h3>
      <p className="text-[13px] text-on-surface-muted">Tax collected from customers vs. tax paid to vendors, for filing.</p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label>From</Label>
          <DatePicker value={from} onChange={setFrom} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>To</Label>
          <DatePicker value={to} onChange={setTo} />
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          {loading ? <Spinner size="sm" /> : "Refresh"}
        </Button>
      </div>

      {error && <p className="text-[13px] text-overdue">{error}</p>}

      {report && !error && (
        <div className="flex flex-col gap-3 rounded-md border border-border-strong p-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] font-medium text-on-surface-muted">Collected</p>
              <p className="text-[15px] font-semibold text-on-surface">{money(report.taxCollected)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-on-surface-muted">Paid</p>
              <p className="text-[15px] font-semibold text-on-surface">{money(report.taxPaid)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-on-surface-muted">Net payable</p>
              <p className="text-[15px] font-semibold text-on-surface">{money(report.netTaxPayable)}</p>
            </div>
          </div>

          {report.collectedByRate.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-border pt-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">Collected by rate</p>
              {report.collectedByRate.map((row) => (
                <div key={row.name} className="flex items-center justify-between text-[13px]">
                  <span className="text-on-surface">
                    {row.name}
                    {row.percentage > 0 && <span className="text-on-surface-muted"> ({row.percentage}%)</span>}
                  </span>
                  <span className="font-mono tabular-nums text-on-surface">{money(row.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaxRatesSection({
  rates,
  onChanged,
  onSaved,
}: {
  rates: TaxRate[];
  onChanged: () => Promise<void>;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<TaxRate | "new" | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted">Tax rates</h3>
        <Button variant="ghost" size="sm" onClick={() => setEditing("new")} className="gap-1">
          <Plus size={14} /> Add rate
        </Button>
      </div>

      {rates.length === 0 && <p className="text-[13px] text-on-surface-muted">No tax rates yet.</p>}

      <div className="flex flex-col divide-y divide-border rounded-md border border-border-strong">
        {rates.map((rate) => (
          <TaxRateRow
            key={rate.id}
            rate={rate}
            onEdit={() => setEditing(rate)}
            onChanged={async () => {
              await onChanged();
              onSaved();
            }}
          />
        ))}
      </div>

      {editing !== null && (
        <TaxRateDialog
          rate={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
            onSaved();
          }}
        />
      )}
    </div>
  );
}

function TaxRateRow({ rate, onEdit, onChanged }: { rate: TaxRate; onEdit: () => void; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  async function handleArchiveOrRestore() {
    setBusy(true);
    try {
      await apiClient.post(`/tax-rates/${rate.id}/${rate.archivedAt ? "restore" : "archive"}`);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-medium text-on-surface">
          {rate.name}
          {rate.archivedAt && <span className="ml-2 text-[11px] font-normal text-on-surface-muted">Archived</span>}
        </span>
        <span className="text-[12px] text-on-surface-muted">
          {rate.rate}% {rate.isCompound && "· compound"}
        </span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${rate.name}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={handleArchiveOrRestore}>
            {rate.archivedAt ? "Restore" : "Archive"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TaxRateDialog({
  rate,
  onClose,
  onSaved,
}: {
  rate: TaxRate | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(rate?.name ?? "");
  const [rateValue, setRateValue] = useState(rate ? String(rate.rate) : "");
  const [isCompound, setIsCompound] = useState(rate?.isCompound ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = { name, rate: Number(rateValue), isCompound };
      if (rate) {
        await apiClient.put(`/tax-rates/${rate.id}`, body);
      } else {
        await apiClient.post("/tax-rates", body);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save tax rate.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{rate ? "Edit tax rate" : "Add tax rate"}</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="flex flex-col gap-3 pt-2 text-left">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tax-rate-name">Name</Label>
                <Input id="tax-rate-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GST" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tax-rate-percentage">Rate (%)</Label>
                <Input
                  id="tax-rate-percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={rateValue}
                  onChange={(e) => setRateValue(e.target.value)}
                />
              </div>
              <label htmlFor="tax-rate-compound" className="flex cursor-pointer items-center gap-2">
                <Checkbox id="tax-rate-compound" checked={isCompound} onCheckedChange={(v) => setIsCompound(v === true)} />
                <span className="text-[13px] text-on-surface">
                  Compound — tax this rate on top of prior rates already applied to the line, not just the base amount.
                </span>
              </label>
              {error && <p className="text-[13px] text-overdue">{error}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={saving || !name || rateValue === ""} onClick={handleSave}>
            {saving ? <Spinner size="sm" /> : "Save"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TaxGroupsSection({
  groups,
  rates,
  onChanged,
  onSaved,
}: {
  groups: TaxGroup[];
  rates: TaxRate[];
  onChanged: () => Promise<void>;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<TaxGroup | "new" | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted">Tax groups</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing("new")}
          disabled={rates.length === 0}
          className="gap-1"
        >
          <Plus size={14} /> Add group
        </Button>
      </div>

      {rates.length === 0 && (
        <p className="text-[13px] text-on-surface-muted">Add at least one tax rate before creating a group.</p>
      )}
      {rates.length > 0 && groups.length === 0 && <p className="text-[13px] text-on-surface-muted">No tax groups yet.</p>}

      <div className="flex flex-col divide-y divide-border rounded-md border border-border-strong">
        {groups.map((group) => (
          <TaxGroupRow
            key={group.id}
            group={group}
            onEdit={() => setEditing(group)}
            onChanged={async () => {
              await onChanged();
              onSaved();
            }}
          />
        ))}
      </div>

      {editing !== null && (
        <TaxGroupDialog
          group={editing === "new" ? null : editing}
          rates={rates}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
            onSaved();
          }}
        />
      )}
    </div>
  );
}

function TaxGroupRow({ group, onEdit, onChanged }: { group: TaxGroup; onEdit: () => void; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  async function handleArchiveOrRestore() {
    setBusy(true);
    try {
      await apiClient.post(`/tax-groups/${group.id}/${group.archivedAt ? "restore" : "archive"}`);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-medium text-on-surface">
          {group.name}
          {group.archivedAt && <span className="ml-2 text-[11px] font-normal text-on-surface-muted">Archived</span>}
        </span>
        <span className="text-[12px] text-on-surface-muted">
          {group.taxRates.map((r) => `${r.name} (${r.rate}%)`).join(" + ") || "No rates"}
        </span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${group.name}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={handleArchiveOrRestore}>
            {group.archivedAt ? "Restore" : "Archive"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TaxGroupDialog({
  group,
  rates,
  onClose,
  onSaved,
}: {
  group: TaxGroup | null;
  rates: TaxRate[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [taxRateIds, setTaxRateIds] = useState<string[]>(group?.taxRates.map((r) => r.id) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = { name, taxRateIds };
      if (group) {
        await apiClient.put(`/tax-groups/${group.id}`, body);
      } else {
        await apiClient.post("/tax-groups", body);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save tax group.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{group ? "Edit tax group" : "Add tax group"}</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="flex flex-col gap-3 pt-2 text-left">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tax-group-name">Name</Label>
                <Input id="tax-group-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CGST + SGST" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tax-group-rates">Rates</Label>
                <MultiSelect
                  options={rates.map((r) => ({ value: r.id, label: `${r.name} (${r.rate}%)` }))}
                  value={taxRateIds}
                  onValueChange={setTaxRateIds}
                  placeholder="Select rates…"
                  aria-label="Rates"
                />
              </div>
              {error && <p className="text-[13px] text-overdue">{error}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={saving || !name || taxRateIds.length === 0} onClick={handleSave}>
            {saving ? <Spinner size="sm" /> : "Save"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
