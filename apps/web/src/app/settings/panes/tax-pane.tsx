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
import { MoreHorizontal, Plus } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
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

      <div className="flex items-center justify-between rounded-md border border-border-strong bg-surface p-3">
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

      <SavedToast open={saved} onOpenChange={setSaved} />
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

      <div className="flex flex-col divide-y divide-border rounded-md border border-border-strong bg-surface">
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

      <div className="flex flex-col divide-y divide-border rounded-md border border-border-strong bg-surface">
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
