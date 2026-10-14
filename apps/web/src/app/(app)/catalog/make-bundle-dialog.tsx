"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  HelperText,
  Input,
  Spinner,
  Textarea,
} from "@spine/ui";
import { BUNDLE_NAME_REQUIRED, BUNDLE_ONE_CURRENCY, MAX_BUNDLE_ITEMS, type CatalogBundle } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import type { CatalogItem } from "./types";

/** US-CAT-14 — a line's amount before tax: quantity × default price, rounded half-up once. */
export function lineAmount(item: CatalogItem, quantity: number): bigint {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0n;
  return BigInt(Math.round(Number(item.defaultPriceAmount) * quantity));
}

/**
 * US-CAT-14 (D-213) — Make a bundle from the selected items: a name, an
 * optional description and a quantity per item (1 to start). The API saves
 * each line at the item's default price and tax; the total here is before
 * tax, since the tax depends on the document it lands on.
 */
export function MakeBundleDialog({
  items,
  open,
  onOpenChange,
  onSaved,
  taxText,
}: {
  items: CatalogItem[];
  /** The item's tax as the table names it ("Sales tax 8%", "No tax"). */
  taxText?: (item: CatalogItem) => string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (bundle: CatalogBundle) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setQuantities(Object.fromEntries(items.map((item) => [item.id, "1"])));
    setNameError(undefined);
    setError(null);
  }, [open, items]);

  const currencies = new Set(items.map((item) => item.defaultPriceCurrency));
  const currency = items[0]?.defaultPriceCurrency ?? "USD";
  const quantityOf = (id: string) => Number(quantities[id] ?? "1");
  const total = items.reduce((sum, item) => sum + lineAmount(item, quantityOf(item.id)), 0n);
  const badQuantity = items.some((item) => !(quantityOf(item.id) > 0));
  const blocked = currencies.size > 1 ? BUNDLE_ONE_CURRENCY : items.length > MAX_BUNDLE_ITEMS ? `A bundle holds up to ${MAX_BUNDLE_ITEMS} items.` : null;

  async function save() {
    if (!name.trim()) {
      setNameError(BUNDLE_NAME_REQUIRED);
      return;
    }
    setNameError(undefined);
    setSaving(true);
    setError(null);
    try {
      const bundle = await apiClient.post<CatalogBundle>("/catalog-bundles", {
        name: name.trim(),
        description: description.trim() || undefined,
        items: items.map((item) => ({ catalogItemId: item.id, quantity: quantityOf(item.id) })),
      });
      onOpenChange(false);
      onSaved(bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the bundle. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Make a bundle</DialogTitle>
          <DialogDescription>Group these items so they&apos;re one pick on a quote or invoice. Prices and tax come from each item; you can change them on the document.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {(error || blocked) && (
            <Alert variant="critical">
              <AlertDescription>{blocked ?? error}</AlertDescription>
            </Alert>
          )}
          <FormField label="Name" errorText={nameError} required>
            {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} placeholder="For example, Bathroom refit" />}
          </FormField>
          <FormField label="Description (optional)">
            {(field) => <Textarea {...field} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's included, for your team" />}
          </FormField>
          <div className="overflow-hidden rounded-md border border-border" data-testid="bundle-lines">
            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_8rem] gap-3 border-b border-border bg-surface-sunken px-3 py-2 text-[12px] font-semibold text-on-surface-muted">
              <span>Item</span>
              <span className="text-right">Quantity</span>
              <span className="text-right">Amount</span>
            </div>
            <ul className="max-h-64 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_6.5rem_8rem] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium text-on-surface">{item.name}</span>
                    <span className="block truncate text-[12px] text-on-surface-muted">
                      {item.unit} · {formatMoney(BigInt(item.defaultPriceAmount), item.defaultPriceCurrency)}
                      {taxText ? ` · ${taxText(item)}` : ""}
                    </span>
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    aria-label={`Quantity of ${item.name}`}
                    aria-invalid={!(quantityOf(item.id) > 0) || undefined}
                    value={quantities[item.id] ?? "1"}
                    onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: e.target.value }))}
                    className="text-right tabular-nums"
                  />
                  <span className="text-right text-[13.5px] tabular-nums">{formatMoney(lineAmount(item, quantityOf(item.id)), item.defaultPriceCurrency)}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3 border-t border-border bg-surface-sunken px-3 py-2 text-[13.5px] font-semibold">
              <span>Total before tax</span>
              <span className="text-right tabular-nums" data-testid="bundle-total">
                {formatMoney(total, currency)}
              </span>
            </div>
          </div>
          {badQuantity && <HelperText error>Give each item a quantity above 0.</HelperText>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || badQuantity || Boolean(blocked)}>
            {saving ? <Spinner size="sm" /> : "Save bundle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
