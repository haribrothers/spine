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
  useConfirm,
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
 * Set tax, Set category and Set income account ask first (US-CAT-16,
 * D-223); Archive and
 * Restore don't — Restore undoes them.
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
  onFailed,
}: {
  selected: CatalogItem[];
  gst: boolean;
  categories: string[];
  rates: TaxRateOption[];
  groups: TaxGroupOption[];
  incomeAccounts: Account[];
  onClear: () => void;
  onMakeBundle: () => void;
  /** A bulk change finished: what to tell the person. */
  onFinished: (title: string, description: string) => void;
  /** It didn't: shown above the list, the selection kept (US-OPS-38). */
  onFailed: (title: string, message: string) => void;
}) {
  const canEdit = useCapability("catalog.edit_own");
  const canDelete = useCapability("catalog.delete_own");
  const [busy, setBusy] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [category, setCategory] = useState("");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const allArchived = selected.length > 0 && selected.every((item) => item.archivedAt);
  const items = `${selected.length} ${selected.length === 1 ? "item" : "items"}`;

  /** US-CAT-16 — "Change the tax on 12 items?" before the change; Go back keeps the selection. */
  async function setTax(label: string | null, changes: NonNullable<BulkCatalogItemsInput["changes"]>) {
    const ok = await confirm({
      title: `Change the tax on ${items}?`,
      description: `${selected.length === 1 ? "It'll" : "They'll"} ${label ? `use ${label}` : "have no tax"} on new quotes and invoices. Quotes and invoices already issued keep their tax.`,
      confirmLabel: "Change tax",
      cancelLabel: "Go back",
    });
    if (ok) await run({ action: "update", changes }, "Updated");
  }

  /** US-CAT-16 — "Change the income account on 12 items?"; Go back keeps the selection. */
  async function setIncomeAccount(account: Account | null) {
    const ok = await confirm({
      title: `Change the income account on ${items}?`,
      description: `New quotes and invoices post ${selected.length === 1 ? "its" : "their"} sales to ${account ? `${account.code} ${account.name}` : "4100 Sales — Services"}. Quotes and invoices already issued keep theirs.`,
      confirmLabel: "Change account",
      cancelLabel: "Go back",
    });
    if (ok) await run({ action: "update", changes: { incomeAccountId: account?.id ?? null } }, "Updated");
  }

  /** US-CAT-16 — "Move 12 items to “Labour”?"; Go back returns to the category dialog. */
  async function setCategoryConfirmed() {
    const name = category.trim();
    const ok = await confirm({
      title: name ? `Move ${items} to “${name}”?` : `Remove the category from ${items}?`,
      description: name ? `${selected.length === 1 ? "It shows" : "They show"} under “${name}” in the catalogue and the item pickers.` : `${selected.length === 1 ? "It shows" : "They show"} with no category in the catalogue and the item pickers.`,
      confirmLabel: name ? "Move items" : "Remove category",
      cancelLabel: "Go back",
    });
    if (!ok) return;
    await run({ action: "update", changes: { category: name } }, "Updated");
    setCategoryOpen(false);
  }
  const anyArchived = selected.some((item) => item.archivedAt);

  async function run(body: Omit<BulkCatalogItemsInput, "ids">, verb: "Updated" | "Archived" | "Restored") {
    if (selected.length > MAX_CATALOG_BULK) {
      onFailed("Too many items.", `Select ${MAX_CATALOG_BULK} or fewer items.`);
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/catalog-items/bulk", { ids: selected.map((item) => item.id), ...body });
      onFinished(bulkToast(verb, selected.length), verb === "Archived" ? "They're hidden from pickers; restore them any time." : "Your catalogue is up to date.");
    } catch (err) {
      onFailed("Nothing changed.", err instanceof Error ? err.message : "Try again.");
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
            <DropdownMenuItem onSelect={() => void setTax(null, { defaultTaxRateId: null, defaultTaxGroupId: null, ...noInter })}>No tax</DropdownMenuItem>
            {activeGroups.map((g) => (
              <DropdownMenuItem key={g.id} onSelect={() => void setTax(`${g.name} (${g.taxRates.map((r) => `${r.rate}%`).join(" + ")})`, { defaultTaxGroupId: g.id, defaultTaxRateId: null, ...interFor(g) })}>
                {g.name}
                <span className="ml-auto text-[12px] text-on-surface-muted">{g.taxRates.map((r) => `${r.rate}%`).join(" + ")}</span>
              </DropdownMenuItem>
            ))}
            {activeRates.map((r) => (
              <DropdownMenuItem key={r.id} onSelect={() => void setTax(`${r.name} (${r.rate}%)`, { defaultTaxRateId: r.id, defaultTaxGroupId: null })}>
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
            <DropdownMenuItem onSelect={() => void setIncomeAccount(null)}>
              None — posts to 4100 Sales — Services
            </DropdownMenuItem>
            {incomeAccounts.map((a) => (
              <DropdownMenuItem key={a.id} onSelect={() => void setIncomeAccount(a)}>
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
              onClick={() => void setCategoryConfirmed()}
            >
              {busy ? <Spinner size="sm" /> : "Set category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
