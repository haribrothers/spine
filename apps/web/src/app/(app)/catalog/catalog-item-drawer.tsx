"use client";

import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Spinner,
} from "@spine/ui";
import { useEffect, useId, useState } from "react";
import type { CatalogItemUsage } from "@spine/shared";
import { FileText } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { HistorySection } from "../../../components/history-section";
import { CatalogForm } from "./catalog-form";
import type { CatalogItem } from "./types";

/** US-CAT-15 — "Used on 4 quotes and 2 invoices · last quoted 3 Oct 2026", or that it isn't used yet. */
export function usageText(usage: CatalogItemUsage): string {
  if (usage.quotes === 0 && usage.invoices === 0) return "Not used on a quote or invoice yet.";
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const parts = [usage.quotes ? plural(usage.quotes, "quote") : null, usage.invoices ? plural(usage.invoices, "invoice") : null].filter(Boolean).join(" and ");
  const last = usage.lastQuotedAt ? ` · last quoted ${new Date(usage.lastQuotedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : "";
  return `Used on ${parts}${last}`;
}

/**
 * Create-or-edit Drawer for a catalog item, following ContactCreateDrawer's
 * exact composition (form lives outside the footer, footer's Save button
 * submits it via `form={formId}`). One component handles both create and
 * edit — pass `item` to edit, omit it to create — since a catalog item's
 * form has no create-only fields the way ContactForm's logo-upload timing
 * did, so there was no need to split into two components.
 */
export function CatalogItemDrawer({
  open,
  onOpenChange,
  item,
  prefill,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: CatalogItem;
  /** US-CAT-12 — Duplicate: a new item filled from this one. */
  prefill?: CatalogItem;
  onSaved: (item: CatalogItem, mode: "created" | "updated") => void;
}) {
  const formId = useId();
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<CatalogItemUsage | null>(null);

  // US-CAT-15: where the item is used (Owner and Staff; it stays quiet for anyone else).
  const itemId = item?.id ?? null;
  useEffect(() => {
    setUsage(null);
    if (!open || !itemId) return;
    apiClient
      .get<CatalogItemUsage>(`/catalog-items/${itemId}/usage`)
      .then(setUsage)
      .catch(() => setUsage(null));
  }, [open, itemId]);

  function handleSuccess(saved: CatalogItem) {
    setSaving(false);
    onOpenChange(false);
    onSaved(saved, item ? "updated" : "created");
  }

  // The Drawer's content stays mounted across close/reopen (this component
  // handles both create and edit in one long-lived instance, unlike
  // ContactCreateDrawer's create-only, remount-per-open shape), so `saving`
  // must be reset explicitly on close — otherwise a prior submit's `true`
  // (set right before handleSuccess/onOpenChange(false) fire) leaks into
  // the next open as a stuck spinner with no label.
  function handleOpenChange(next: boolean) {
    if (!next) setSaving(false);
    onOpenChange(next);
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{item ? "Edit item" : "Add item"}</DrawerTitle>
          <DrawerDescription>
            {item
              ? "Update this item's default price, tax rate or account mapping."
              : prefill
                ? "A copy of another item. Change what's different, then save it as a new item."
                : "Goods or services with a default price and tax rate — you can override the price on a quote later."}
          </DrawerDescription>
          {item && usage && (
            <p className="mt-2 flex items-center gap-2 rounded-md bg-surface-sunken px-2.5 py-2 text-[12.5px] text-on-surface-muted" data-testid="catalog-usage">
              <FileText size={14} aria-hidden className="shrink-0 text-primary" />
              {usageText(usage)}
            </p>
          )}
        </DrawerHeader>
        <DrawerBody>
          <CatalogForm key={item?.id ?? prefill?.id ?? "new"} formId={formId} item={item} prefill={prefill} onSubmittingChange={setSaving} onSuccess={handleSuccess} />
        </DrawerBody>
        <DrawerFooter>
          {item && <HistorySection endpoint={`/catalog-items/${item.id}/history`} subjectLabel="this item" />}
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? <Spinner size="sm" /> : "Save item"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
