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
import { useT } from "../../../lib/i18n";

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
  const t = useT();
  const canEdit = useCapability("catalog.edit_own");
  const canDelete = useCapability("catalog.delete_own");
  const [busy, setBusy] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [category, setCategory] = useState("");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const allArchived = selected.length > 0 && selected.every((item) => item.archivedAt);
  const items = t("catalog.bulk.items", { count: selected.length });

  /** US-CAT-16 — "Change the tax on 12 items?" before the change; Go back keeps the selection. */
  async function setTax(label: string | null, changes: NonNullable<BulkCatalogItemsInput["changes"]>) {
    const ok = await confirm({
      title: t("catalog.bulk.taxTitle", { items }),
      description: label ? t("catalog.bulk.taxUse", { count: selected.length, label }) : t("catalog.bulk.taxNone", { count: selected.length }),
      confirmLabel: t("catalog.bulk.taxConfirm"),
      cancelLabel: t("catalog.common.goBack"),
    });
    if (ok) await run({ action: "update", changes }, "Updated");
  }

  /** US-CAT-16 — "Change the income account on 12 items?"; Go back keeps the selection. */
  async function setIncomeAccount(account: Account | null) {
    const ok = await confirm({
      title: t("catalog.bulk.incomeTitle", { items }),
      description: t("catalog.bulk.incomeDescription", { count: selected.length, account: account ? `${account.code} ${account.name}` : t("catalog.common.defaultIncomeAccount") }),
      confirmLabel: t("catalog.bulk.incomeConfirm"),
      cancelLabel: t("catalog.common.goBack"),
    });
    if (ok) await run({ action: "update", changes: { incomeAccountId: account?.id ?? null } }, "Updated");
  }

  /** US-CAT-16 — "Move 12 items to “Labour”?"; Go back returns to the category dialog. */
  async function setCategoryConfirmed() {
    const name = category.trim();
    const ok = await confirm({
      title: name ? t("catalog.bulk.moveTitle", { items, name }) : t("catalog.bulk.removeCategoryTitle", { items }),
      description: name ? t("catalog.bulk.moveDescription", { count: selected.length, name }) : t("catalog.bulk.removeCategoryDescription", { count: selected.length }),
      confirmLabel: name ? t("catalog.bulk.moveConfirm") : t("catalog.bulk.removeCategoryConfirm"),
      cancelLabel: t("catalog.common.goBack"),
    });
    if (!ok) return;
    await run({ action: "update", changes: { category: name } }, "Updated");
    setCategoryOpen(false);
  }
  const anyArchived = selected.some((item) => item.archivedAt);

  async function run(body: Omit<BulkCatalogItemsInput, "ids">, verb: "Updated" | "Archived" | "Restored") {
    if (selected.length > MAX_CATALOG_BULK) {
      onFailed(t("catalog.bulk.tooManyTitle"), t("catalog.bulk.tooManyMessage", { max: MAX_CATALOG_BULK }));
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/catalog-items/bulk", { ids: selected.map((item) => item.id), ...body });
      onFinished(bulkToast(verb, selected.length), verb === "Archived" ? t("catalog.bulk.archivedDescription") : t("catalog.bulk.updatedDescription"));
    } catch (err) {
      onFailed(t("catalog.bulk.failedTitle"), err instanceof Error ? err.message : t("catalog.bulk.tryAgain"));
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
    <div role="region" aria-label={t("catalog.bulk.regionLabel")} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-inverse-surface px-3 py-2" data-testid="catalog-bulk-bar">
      <p className="mr-2 pl-1 text-[14px] font-semibold text-inverse-on-surface" aria-live="polite">
        {t("catalog.bulk.selectedCount", { count: selected.length })}
      </p>
      {canEdit && (
        <Button variant="ghost" size="sm" className={actionClass} disabled={busy} onClick={() => { setCategory(""); setCategoryOpen(true); }}>
          <Tag size={14} aria-hidden />
          {t("catalog.bulk.setCategory")}
        </Button>
      )}
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={actionClass} disabled={busy}>
              <Percent size={14} aria-hidden />
              {t("catalog.bulk.setTax")}
              <ChevronDown size={14} aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>{gst ? t("catalog.bulk.intraStateTax") : t("catalog.common.tax")}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void setTax(null, { defaultTaxRateId: null, defaultTaxGroupId: null, ...noInter })}>{t("catalog.common.noTax")}</DropdownMenuItem>
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
                <p className="px-2 py-1.5 text-[12px] text-on-surface-muted">{t("catalog.bulk.interStateNote")}</p>
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
              {t("catalog.bulk.setIncomeAccount")}
              <ChevronDown size={14} aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>{t("catalog.common.incomeAccount")}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void setIncomeAccount(null)}>
              {t("catalog.bulk.noIncomeAccount")}
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
            {t("catalog.common.restore")}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className={actionClass} disabled={busy} onClick={() => void run({ action: "archive" }, "Archived")}>
            <Archive size={14} aria-hidden />
            {t("catalog.common.archive")}
          </Button>
        ))}
      {canEdit && !anyArchived && (
        <Button variant="ghost" size="sm" className={actionClass} disabled={busy} onClick={onMakeBundle}>
          <PackagePlus size={14} aria-hidden />
          {t("catalog.common.makeBundle")}
        </Button>
      )}
      <span className="flex-1" />
      {busy && <Spinner size="sm" className="text-inverse-on-surface" />}
      <Button variant="ghost" size="sm" className={actionClass} onClick={onClear}>
        <X size={14} aria-hidden />
        {t("catalog.common.clear")}
      </Button>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("catalog.bulk.setCategory")}</DialogTitle>
            <DialogDescription>
              {t("catalog.bulk.categoryDialogDescription", { count: selected.length })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label={t("catalog.common.category")}>
              {(field) => (
                <Combobox
                  {...field}
                  options={categories.map((c) => ({ value: c, label: c }))}
                  value={category}
                  onValueChange={setCategory}
                  placeholder={t("catalog.bulk.categoryPlaceholder")}
                  allowCreate
                />
              )}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCategoryOpen(false)}>
              {t("catalog.common.cancel")}
            </Button>
            <Button
              disabled={busy}
              onClick={() => void setCategoryConfirmed()}
            >
              {busy ? <Spinner size="sm" /> : t("catalog.bulk.setCategory")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
