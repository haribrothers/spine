"use client";

import { useEffect, useState } from "react";
import {
  Alert,
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
  Combobox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
} from "@spine/ui";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  GENERAL_TAX_TYPES,
  INDIA_TAX_TYPES,
  TAX_COUNTRIES,
  TAX_TYPE_LABELS,
  taxCountryLabel,
  SUPPLY_CLASS_LABELS,
  type SupplyClass,
  type TaxChoice,
  type TaxCountry,
  type TaxGroupScope,
  type TaxProfileUpdate,
  type TaxType,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { SavedToast } from "../saved-toast";

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  isCompound: boolean;
  taxType: TaxType;
  /** D-182 — what a 0% rate means for its lines. */
  supplyClass: SupplyClass | null;
  archivedAt: string | null;
}

interface TaxGroup {
  id: string;
  name: string;
  scope: TaxGroupScope;
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
  // US-DASH-25 — the period the dashboard's "Tax this period" covers.
  const [taxProfile, setTaxProfile] = useState<Record<string, unknown> & { returnPeriod?: "monthly" | "quarterly" }>({});
  // US-TAX-09 — how many rates the last country change added.
  const [added, setAdded] = useState<number | null>(null);

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
    apiClient
      .get<{ value: (Record<string, unknown> & { returnPeriod?: "monthly" | "quarterly" }) | null }>("/org/settings/tax_profile")
      .then((res) => setTaxProfile(res.value ?? {}))
      .catch(() => {});
  }, []);

  const country: TaxCountry = (TAX_COUNTRIES as readonly string[]).includes(taxProfile.country as string) ? (taxProfile.country as TaxCountry) : "other";

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

      <div className="flex flex-col gap-2">
        <h3 id="tax-country-label" className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted">
          Country
        </h3>
        <Select
          value={country}
          onValueChange={async (v) => {
            const res = await apiClient.put<TaxProfileUpdate>("/org/tax/profile", { country: v });
            setTaxProfile(res.profile);
            setAdded(res.added);
            await reload();
            setSaved(true);
          }}
        >
          <SelectTrigger aria-labelledby="tax-country-label" aria-describedby="tax-country-help">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAX_COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {taxCountryLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p id="tax-country-help" className="text-[12px] text-on-surface-muted">
          Changing country adds that country&apos;s rates. Existing rates are never changed or deleted.
        </p>
        {added !== null && added > 0 && (
          <Alert variant="success">Added {added} rates. Your existing rates are unchanged — archive the ones you no longer use.</Alert>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-strong bg-surface p-3">
        <div>
          <p className="text-[14px] font-medium text-on-surface" id="return-period-label">
            Return period
          </p>
          <p className="text-[13px] text-on-surface-muted">How often you file tax returns. The dashboard&apos;s &quot;Tax this period&quot; covers this month or this quarter.</p>
        </div>
        <Select
          value={taxProfile.returnPeriod ?? "monthly"}
          onValueChange={async (v) => {
            const next = { ...taxProfile, returnPeriod: v as "monthly" | "quarterly" };
            setTaxProfile(next);
            await apiClient.put("/org/settings/tax_profile", { value: next });
            setSaved(true);
          }}
        >
          <SelectTrigger className="w-40" aria-labelledby="return-period-label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TaxRatesSection rates={rates} country={country} onChanged={reload} onSaved={() => setSaved(true)} />
      <TaxGroupsSection groups={groups} rates={rates.filter((r) => !r.archivedAt)} onChanged={reload} onSaved={() => setSaved(true)} />

      {country === "IN" && (
        <DefaultTaxPreference
          rates={rates.filter((r) => !r.archivedAt)}
          groups={groups.filter((g) => !g.archivedAt)}
          intra={(taxProfile.defaultIntraTax as TaxChoice | null | undefined) ?? null}
          inter={(taxProfile.defaultInterTax as TaxChoice | null | undefined) ?? null}
          onSave={async (patch) => {
            const res = await apiClient.put<TaxProfileUpdate>("/org/tax/profile", patch);
            setTaxProfile(res.profile);
            setSaved(true);
          }}
        />
      )}

      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}

/**
 * US-TAX-13 — the intra- and inter-state taxes a new catalogue item starts
 * with (India). Each item can still pick its own.
 */
function DefaultTaxPreference({
  rates,
  groups,
  intra,
  inter,
  onSave,
}: {
  rates: TaxRate[];
  groups: TaxGroup[];
  intra: TaxChoice | null;
  inter: TaxChoice | null;
  onSave: (patch: { defaultIntraTax?: TaxChoice; defaultInterTax?: TaxChoice }) => Promise<void>;
}) {
  const options = [
    { value: "", label: "No tax" },
    ...groups.map((g) => ({ value: `group:${g.id}`, label: g.name })),
    ...rates.map((r) => ({ value: `rate:${r.id}`, label: r.name })),
  ];
  const token = (t: TaxChoice | null) => (t?.taxRateId ? `rate:${t.taxRateId}` : t?.taxGroupId ? `group:${t.taxGroupId}` : "");
  const choice = (value: string): TaxChoice => ({ taxRateId: value.startsWith("rate:") ? value.slice(5) : null, taxGroupId: value.startsWith("group:") ? value.slice(6) : null });
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted">Default tax preference</h3>
      <p className="text-[13px] text-on-surface-muted">New catalogue items start with these. Spine uses the intra-state tax in your state and the inter-state tax elsewhere.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label id="default-intra-label">Intra-state</Label>
          <Combobox aria-labelledby="default-intra-label" options={options} value={token(intra)} onValueChange={(v) => void onSave({ defaultIntraTax: choice(v) })} placeholder="No tax" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label id="default-inter-label">Inter-state</Label>
          <Combobox aria-labelledby="default-inter-label" options={options} value={token(inter)} onValueChange={(v) => void onSave({ defaultInterTax: choice(v) })} placeholder="No tax" />
        </div>
      </div>
    </div>
  );
}

function TaxRatesSection({
  rates,
  country,
  onChanged,
  onSaved,
}: {
  rates: TaxRate[];
  country: string;
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
          country={country}
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
          {rate.rate}% · {TAX_TYPE_LABELS[rate.taxType]}
          {rate.rate === 0 && rate.supplyClass && ` · ${SUPPLY_CLASS_LABELS[rate.supplyClass]}`}
          {rate.isCompound && " · compound"}
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

/** US-TAX-10 — India picks a GST component; elsewhere a general kind. A rate keeps a type it already has. */
function taxTypeOptions(country: string, current: TaxType | undefined): TaxType[] {
  const base = country === "IN" ? [...INDIA_TAX_TYPES] : [...GENERAL_TAX_TYPES];
  return current && !base.includes(current) ? [...base, current] : base;
}

function defaultTaxType(country: string): TaxType {
  if (country === "IN") return "cgst";
  if (country === "AU" || country === "NZ") return "gst";
  if (country === "GB" || country === "AE" || country === "SA") return "vat";
  return "other";
}

function TaxRateDialog({
  rate,
  country,
  onClose,
  onSaved,
}: {
  rate: TaxRate | null;
  country: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(rate?.name ?? "");
  const [rateValue, setRateValue] = useState(rate ? String(rate.rate) : "");
  const [isCompound, setIsCompound] = useState(rate?.isCompound ?? false);
  const [taxType, setTaxType] = useState<TaxType>(rate?.taxType ?? defaultTaxType(country));
  const [supplyClass, setSupplyClass] = useState<SupplyClass>(rate?.supplyClass ?? "zero_rated");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = { name, rate: Number(rateValue), isCompound, taxType, supplyClass: Number(rateValue) === 0 ? supplyClass : null };
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
              <div className="flex flex-col gap-1.5">
                <Label id="tax-rate-type-label">Tax type</Label>
                <Select value={taxType} onValueChange={(v) => setTaxType(v as TaxType)}>
                  <SelectTrigger aria-labelledby="tax-rate-type-label" aria-describedby="tax-rate-type-help">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taxTypeOptions(country, rate?.taxType).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TAX_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id="tax-rate-type-help" className="text-[12px] text-on-surface-muted">
                  {country === "IN"
                    ? "Reports and GSTR-1 split tax by type: CGST, SGST, UTGST, IGST, cess."
                    : "Reports split tax by type."}
                </p>
              </div>
              {rateValue !== "" && Number(rateValue) === 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label id="tax-rate-supply-label">Lines with this rate are</Label>
                  <Select value={supplyClass} onValueChange={(v) => setSupplyClass(v as SupplyClass)}>
                    <SelectTrigger aria-labelledby="tax-rate-supply-label" aria-describedby="tax-rate-supply-help">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["zero_rated", "exempt", "non_taxable"] as const).map((c) => (
                        <SelectItem key={c} value={c}>
                          {SUPPLY_CLASS_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p id="tax-rate-supply-help" className="text-[12px] text-on-surface-muted">
                    Picking this rate on a line gives the line this supply type.
                  </p>
                </div>
              )}
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
          <AlertDialogAction
            disabled={saving || !name || rateValue === ""}
            onClick={(e) => {
              // Stay open until the save succeeds, so a refusal shows here.
              e.preventDefault();
              handleSave();
            }}
          >
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
          {group.taxRates.map((r) => `${INDIA_TAX_TYPES.includes(r.taxType) ? TAX_TYPE_LABELS[r.taxType] : r.name} (${r.rate}%)`).join(" + ") || "No rates"}
          {group.scope !== "any" && ` · ${group.scope === "intra" ? "Intra-state" : "Inter-state"}`}
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
          <AlertDialogAction
            disabled={saving || !name || taxRateIds.length === 0}
            onClick={(e) => {
              // Stay open until the save succeeds, so a refusal shows here.
              e.preventDefault();
              handleSave();
            }}
          >
            {saving ? <Spinner size="sm" /> : "Save"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
