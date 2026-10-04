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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { MoreHorizontal, Plus } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../../lib/capabilities-context";
import { HistorySection } from "../../../../components/history-section";
import { SavedToast } from "../../../settings/saved-toast";

interface ExpenseCategory {
  id: string;
  name: string;
  accountId: string | null;
  createdByUserId: string | null;
  archivedAt: string | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
}

type AccountsByType = Record<string, Account[]>;

const NO_ACCOUNT = "none";

/**
 * S-09.9's expense-category half — org-configurable categories
 * ("Fuel", "Tools", "Site meals"), each with an optional default posting
 * account. Registered as its own Settings section (not folded into a
 * document-type page) because `expense_categories` is org configuration
 * the same way tax rates/numbering prefixes are — a Field user submitting
 * an expense picks from this list, an Owner/Staff maintains it here.
 * Mirrors tax-pane.tsx's TaxRatesSection/TaxRateRow/TaxRateDialog CRUD-list
 * pattern exactly (AlertDialog-based single-purpose form, not a full
 * Dialog, since there are only two fields).
 */
/**
 * US-PUR-19 (D-078) — Expenses › Categories, moved out of the Owner-only
 * Settings dialog so members with `expense_categories.edit_own` /
 * `edit_others` can manage them. Same layout and API as before.
 */
export function ExpenseCategoriesView() {
  const [categories, setCategories] = useState<ExpenseCategory[] | null>(null);
  const [accounts, setAccounts] = useState<AccountsByType | null>(null);
  const [saved, setSaved] = useState(false);

  async function reload() {
    const [categoriesRes, accountsRes] = await Promise.all([
      apiClient.get<ExpenseCategory[]>("/expense-categories?includeArchived=true"),
      apiClient.get<AccountsByType>("/org/accounts"),
    ]);
    setCategories(categoriesRes);
    setAccounts(accountsRes);
  }

  useEffect(() => {
    void reload();
  }, []);

  if (!categories || !accounts) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const expenseAccounts = accounts.expense ?? [];

  return (
    <div className="flex flex-col gap-6">
      <CategoriesSection categories={categories} accounts={expenseAccounts} onChanged={reload} onSaved={() => setSaved(true)} />
      <p className="text-[13px] text-on-surface-muted">
        Archived categories disappear from the expense form; old expenses keep them. A category no expense uses can be deleted.
      </p>

      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}

function CategoriesSection({
  categories,
  accounts,
  onChanged,
  onSaved,
}: {
  categories: ExpenseCategory[];
  accounts: Account[];
  onChanged: () => Promise<void>;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<ExpenseCategory | "new" | null>(null);
  const canCreate = useCapability("expense_categories.edit_own");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted">Expense categories</h3>
        {canCreate && (
          <Button variant="ghost" size="sm" onClick={() => setEditing("new")} className="gap-1">
            <Plus size={14} /> Add category
          </Button>
        )}
      </div>

      {categories.length === 0 && <p className="text-[13px] text-on-surface-muted">No expense categories yet.</p>}

      <div className="flex flex-col divide-y divide-border rounded-md border border-border-strong bg-surface">
        {categories.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            accounts={accounts}
            onEdit={() => setEditing(category)}
            onChanged={async () => {
              await onChanged();
              onSaved();
            }}
          />
        ))}
      </div>

      {editing !== null && (
        <CategoryDialog
          category={editing === "new" ? null : editing}
          accounts={accounts}
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

function CategoryRow({
  category,
  accounts,
  onEdit,
  onChanged,
}: {
  category: ExpenseCategory;
  accounts: Account[];
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const account = accounts.find((a) => a.id === category.accountId);
  const canEdit = useCanEditOwnership(category.createdByUserId, { own: "expense_categories.edit_own", others: "expense_categories.edit_others" });
  const canDelete = useCanEditOwnership(category.createdByUserId, { own: "expense_categories.delete_own", others: "expense_categories.delete_others" });

  async function handleArchiveOrRestore() {
    setBusy(true);
    try {
      await apiClient.post(`/expense-categories/${category.id}/${category.archivedAt ? "restore" : "archive"}`);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit && !canDelete) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-medium text-on-surface">
            {category.name}
            {category.archivedAt && <span className="ml-2 text-[11px] font-normal text-on-surface-muted">Archived</span>}
          </span>
          <span className="text-[12px] text-on-surface-muted">{account ? `${account.code} · ${account.name}` : "No default account"}</span>
        </div>
        <HistorySection endpoint={`/expense-categories/${category.id}/history`} subjectLabel="this category" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-medium text-on-surface">
          {category.name}
          {category.archivedAt && <span className="ml-2 text-[11px] font-normal text-on-surface-muted">Archived</span>}
        </span>
        <span className="text-[12px] text-on-surface-muted">{account ? `${account.code} · ${account.name}` : "No default account"}</span>
      </div>
      <HistorySection endpoint={`/expense-categories/${category.id}/history`} subjectLabel="this category" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${category.name}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>}
          {canDelete && (
            <DropdownMenuItem disabled={busy} onSelect={handleArchiveOrRestore}>
              {category.archivedAt ? "Restore" : "Archive"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CategoryDialog({
  category,
  accounts,
  onClose,
  onSaved,
}: {
  category: ExpenseCategory | null;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [accountId, setAccountId] = useState(category?.accountId ?? NO_ACCOUNT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = { name, accountId: accountId === NO_ACCOUNT ? null : accountId };
      if (category) {
        await apiClient.put(`/expense-categories/${category.id}`, body);
      } else {
        await apiClient.post("/expense-categories", body);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{category ? "Edit category" : "Add category"}</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="flex flex-col gap-3 pt-2 text-left">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expense-category-name">Name</Label>
                <Input id="expense-category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fuel" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expense-category-account">Default posting account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="expense-category-account">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ACCOUNT}>None</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} · {account.name}
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
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={saving || !name} onClick={handleSave}>
            {saving ? <Spinner size="sm" /> : "Save"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
