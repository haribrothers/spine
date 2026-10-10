"use client";

import { useState } from "react";
import {
  Button,
  Combobox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FormField,
  Spinner,
} from "@spine/ui";
import { MAX_CATALOG_BULK, type BulkCatalogItemsInput } from "@spine/shared";
import { Archive, ArchiveRestore, ChevronDown, Landmark, PackagePlus, Percent, Tag, X } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { bulkToast, interCounterpart } from "./catalog-list-state";
import type { Account, CatalogItem, TaxGroupOption, TaxRateOption } from "./types";

const actionClass = "text-inverse-on-surface hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface";

/**
 * US-CAT-12 (D-213) — the bar over the Catalogue table while rows are
 * ticked: "<n> selected", Set category, Set tax, Set income account,
 * Archive (or Restore when every selected item is archived), Make a bundle
 * (US-CAT-14) and Clear. One save changes every selected item, or none
 * when the person may not change some of them; the API's message says so.
 */
export function CatalogBulkBar({
  selected,
  gst,
  categories,
  rates,
  groups,
  incomeAccounts,
  onClear,
  onMakeBundle,
  onFinished,
}: {
  selected: CatalogItem[];
  gst: boolean;
  categories: string[];
  rates: TaxRateOption[];
  groups: TaxGroupOption[];
  incomeAccounts: Account[];
  onClear: () => void;
  onMakeBundle: () => void;
  /** A bulk change finished: what to tell the person, and whether the list changed. */
  onFinished: (title: string, description: string, changed: boolean) => void;
}) {
  const canEdit = useCapability("catalog.edit_own");
  const canDelete = useCapability("catalog.delete_own");
  const [busy, setBusy] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [category, setCategory] = useState("");
  const allArchived = selected.length > 0 && selected.every((item) => item.archivedAt);
  const anyArchived = selected.some((item) => item.archivedAt);

  async function run(body: Omit<BulkCatalogItemsInput, "ids">, verb: "Updated" | "Archived" | "Restored") {
    if (selected.length > MAX_CATALOG_BULK) {
      onFinished("Too many items", `Select ${MAX_CATALOG_BULK} or fewer items.`, false);
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/catalog-items/bulk", { ids: selected.map((item) => item.id), ...body });
      onFinished(bulkToast(verb, selected.length), verb === "Archived" ? "They're hidden from pickers; restore them any time." : "Your catalogue is up to date.", true);
    } catch (err) {
      onFinished("Nothing changed", err instanceof Error ? err.message : "Try again.", false);
    } finally {
      setBusy(false);
    }
  }

  const activeRates = rates.filter((r) => !r.archivedAt);
  const activeGroups = groups.filter((g) => !g.archivedAt);
  // A GST business's inter-state tax follows: no tax with no tax, IGST at the same rate with a GST group.
  const noInter = gst ? { interTaxRateId: null, interTaxGroupId: null } : {};
  const interFor = (g: TaxGroupOption) => {
    const igst = gst ? interCounterpart(g, rates) : null;
    return igst ? { interTaxRateId: igst.id, interTaxGroupId: null } : {};
  };

  return (
    <div role="region" aria-label="Selected items" className="flex flex-wrap items-center gap-1.5 rounded-lg bg-inverse-surface px-3 py-2" data-testid="catalog-bulk-bar">
      <p className="mr-2 pl-1 text-[14px] font-semibold text-inverse-on-surface" aria-live="polite">
        {selected.length} selected
      </p>
      {canEdit && (
        <Button variant="ghost" size="sm" className={actionClass} disabled={busy} onClick={() => { setCategory(""); setCategoryOpen(true); }}>
          <Tag size={14} aria-hidden />
          Set category
        </Button>
      )}
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={actionClass} disabled={busy}>
              <Percent size={14} aria-hidden />
              Set tax
              <ChevronDown size={14} aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>{gst ? "Intra-state tax" : "Tax"}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void run({ action: "update", changes: { defaultTaxRateId: null, defaultTaxGroupId: null, ...noInter } }, "Updated")}>No tax</DropdownMenuItem>
            {activeGroups.map((g) => (
              <DropdownMenuItem key={g.id} onSelect={() => void run({ action: "update", changes: { defaultTaxGroupId: g.id, defaultTaxRateId: null, ...interFor(g) } }, "Updated")}>
                {g.name}
                <span className="ml-auto text-[12px] text-on-surface-muted">{g.taxRates.map((r) => `${r.rate}%`).join(" + ")}</span>
              </DropdownMenuItem>
            ))}
            {activeRates.map((r) => (
              <DropdownMenuItem key={r.id} onSelect={() => void run({ action: "update", changes: { defaultTaxRateId: r.id, defaultTaxGroupId: null } }, "Updated")}>
                {r.name}
                <span className="ml-auto text-[12px] text-on-surface-muted">{r.rate}%</span>
              </DropdownMenuItem>
            ))}
            {gst && (
              <>
                <DropdownMenuSeparator />
                <p className="px-2 py-1.5 text-[12px] text-on-surface-muted">Inter-state tax follows: the IGST rate at the same total. Without one, each item keeps its own.</p>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={actionClass} disabled={busy}>
              <Landmark size={14} aria-hidden />
              Set income account
              <ChevronDown size={14} aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Income account</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void run({ action: "update", changes: { incomeAccountId: null } }, "Updated")}>
              None — posts to 4100 Sales — Services
            </DropdownMenuItem>
            {incomeAccounts.map((a) => (
              <DropdownMenuItem key={a.id} onSelect={() => void run({ action: "update", changes: { incomeAccountId: a.id } }, "Updated")}>
                <span className="tabular-nums text-on-surface-muted">{a.code}</span>
                {a.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {canDelete &&
        (allArchived ? (
          <Button variant="ghost" size="sm" className={actionClass} disabled={busy} onClick={() => void run({ action: "restore" }, "Restored")}>
            <ArchiveRestore size={14} aria-hidden />
            Restore
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className={actionClass} disabled={busy} onClick={() => void run({ action: "archive" }, "Archived")}>
            <Archive size={14} aria-hidden />
            Archive
          </Button>
        ))}
      {canEdit && !anyArchived && (
        <Button variant="ghost" size="sm" className={actionClass} disabled={busy} onClick={onMakeBundle}>
          <PackagePlus size={14} aria-hidden />
          Make a bundle
        </Button>
      )}
      <span className="flex-1" />
      {busy && <Spinner size="sm" className="text-inverse-on-surface" />}
      <Button variant="ghost" size="sm" className={actionClass} onClick={onClear}>
        <X size={14} aria-hidden />
        Clear
      </Button>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set category</DialogTitle>
            <DialogDescription>
              {selected.length} {selected.length === 1 ? "item moves" : "items move"} to this category. Leave it empty to remove their category.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label="Category">
              {(field) => (
                <Combobox
                  {...field}
                  options={categories.map((c) => ({ value: c, label: c }))}
                  value={category}
                  onValueChange={setCategory}
                  placeholder="Choose or type a category"
                  allowCreate
                />
              )}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCategoryOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                await run({ action: "update", changes: { category: category.trim() } }, "Updated");
                setCategoryOpen(false);
              }}
            >
              {busy ? <Spinner size="sm" /> : "Set category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
