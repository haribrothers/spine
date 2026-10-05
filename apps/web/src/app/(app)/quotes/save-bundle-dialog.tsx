"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Spinner, Textarea } from "@spine/ui";
import { BUNDLE_NAME_REQUIRED, type CatalogBundle } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import type { QuoteLine } from "./types";

/**
 * US-QUO-25 — "Save lines as a bundle…" from a quote's More menu (the
 * `CatalogBundleDialog` design). The server copies the quote's lines, so
 * later changes to the quote never reach the bundle.
 */
export function SaveBundleDialog({
  open,
  onOpenChange,
  quoteId,
  lines,
  currency,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  lines: QuoteLine[];
  currency: string;
  onSaved: (bundle: CatalogBundle) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setNameError(undefined);
    setError(null);
  }, [open]);

  const items = lines.filter((l) => l.type === "item");
  const total = lines.reduce((sum, l) => sum + BigInt(l.lineTotalAmount), 0n);
  const summary = [
    `${items.length} ${items.length === 1 ? "line" : "lines"}`,
    ...items.slice(0, 3).map((l) => `${l.name} × ${l.quantity}`),
    ...(items.length > 3 ? [`and ${items.length - 3} more`] : []),
    formatMoney(total, currency),
  ].join(" · ");

  async function handleSave() {
    if (!name.trim()) {
      setNameError(BUNDLE_NAME_REQUIRED);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const bundle = await apiClient.post<CatalogBundle>("/catalog-bundles", { name: name.trim(), description: description.trim() || null, sourceQuoteId: quoteId });
      onSaved(bundle);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the bundle. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save lines as a bundle</DialogTitle>
          <DialogDescription>Bundles appear in the item picker on quotes and invoices and add all their lines at once. Prices are copied when you add them.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label="Bundle name" errorText={nameError}>
            {(field) => (
              <Input
                {...field}
                value={name}
                placeholder="e.g. Bathroom refit — standard"
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError && e.target.value.trim()) setNameError(undefined);
                }}
              />
            )}
          </FormField>
          <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-[14px] text-on-surface">{summary}</p>
          <FormField label="Description">
            {(field) => <Textarea {...field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : "Save bundle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
