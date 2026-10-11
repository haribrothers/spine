"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks, MoreHorizontal, PackagePlus } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  FormField,
  Input,
  MultiSelect,
  Skeleton,
  Spinner,
  Textarea,
  type TableColumn,
} from "@spine/ui";
import { BUNDLE_NAME_REQUIRED, type CatalogBundle } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { useToast } from "../../../components/toast-host";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

/**
 * US-QUO-25 — Catalogue › Bundles: the bundles saved from quotes, with
 * their lines and total. Rename needs `catalog.edit_*`; archive, restore
 * and delete need `catalog.delete_*`, own or others by who saved it — the
 * same rules the API applies.
 */
export function BundlesView({ onChooseItems, onCountChange }: { onChooseItems?: () => void; onCountChange?: (active: number) => void } = {}) {
  const [bundles, setBundles] = useState<CatalogBundle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>(["active"]);
  const [editing, setEditing] = useState<CatalogBundle | null>(null);
  const showToast = useToast();

  const load = useCallback(() => {
    apiClient
      .get<CatalogBundle[]>("/catalog-bundles?includeArchived=true")
      .then((rows) => {
        setBundles(rows);
        onCountChange?.(rows.filter((b) => !b.archivedAt).length);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load bundles."));
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () => (bundles ?? []).filter((b) => statusFilter.length === 0 || statusFilter.includes(b.archivedAt ? "archived" : "active")),
    [bundles, statusFilter],
  );

  const columns: TableColumn<CatalogBundle>[] = [
    {
      key: "name",
      header: "Bundle",
      render: (b) => (
        <div className="flex flex-col">
          <span className="font-medium text-on-surface">{b.name}</span>
          {b.description && <span className="text-[12px] text-on-surface-muted">{b.description}</span>}
        </div>
      ),
      sortValue: (b) => b.name,
    },
    {
      key: "lines",
      header: "Lines",
      render: (b) => {
        const items = b.lines.filter((l) => l.type === "item");
        return (
          <span className="text-on-surface-muted">
            {items.length} {items.length === 1 ? "line" : "lines"}: {items.map((l) => l.name).join(", ")}
          </span>
        );
      },
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (b) => <span className="tabular-nums">{formatMoney(BigInt(b.totalAmount), b.currency)}</span>,
      sortValue: (b) => BigInt(b.totalAmount),
    },
    {
      key: "status",
      header: "Status",
      render: (b) => (b.archivedAt ? <Badge>Archived</Badge> : <Badge className="bg-paid-bg text-paid">Active</Badge>),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (b) => <BundleRowActions bundle={b} onEdit={setEditing} onChanged={(verb) => (showToast(`Bundle ${verb}`, `“${b.name}” was ${verb}.`), load())} />,
    },
  ];

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!bundles) return <Skeleton className="h-48 rounded-lg" />;

  return (
    <div className="flex flex-col gap-4">
      {bundles.length === 0 ? (
        // US-CAT-14 (D-213): say how to make one, and offer the way in.
        <div className="rounded-lg border border-border bg-surface" data-testid="bundles-empty">
          <EmptyState
            icon={<PackagePlus />}
            title="No bundles yet"
            description="Group what you quote together. Select items and choose Make a bundle, or save a quote's lines from its More menu."
            action={
              onChooseItems ? (
                <Button onClick={onChooseItems}>
                  <ListChecks size={14} aria-hidden />
                  Choose items
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="w-56">
            <MultiSelect options={STATUS_OPTIONS} value={statusFilter} onValueChange={setStatusFilter} placeholder="All statuses" aria-label="Filter by status" />
          </div>
          <DataTable columns={columns} data={shown} rowKey={(b) => b.id} searchPlaceholder="Search bundles" searchKey={(b) => `${b.name} ${b.description ?? ""}`} />
        </>
      )}
      <EditBundleDialog bundle={editing} onClose={() => setEditing(null)} onSaved={() => (showToast("Bundle saved", "Your changes have been saved."), load())} />
    </div>
  );
}

function BundleRowActions({ bundle, onEdit, onChanged }: { bundle: CatalogBundle; onEdit: (b: CatalogBundle) => void; onChanged: (verb: "archived" | "restored" | "deleted") => void }) {
  const canEdit = useCanEditOwnership(bundle.createdByUserId, { own: "catalog.edit_own", others: "catalog.edit_others" });
  const canDelete = useCanEditOwnership(bundle.createdByUserId, { own: "catalog.delete_own", others: "catalog.delete_others" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!canEdit && !canDelete) return null;

  async function toggleArchived() {
    setBusy(true);
    try {
      await apiClient.post(`/catalog-bundles/${bundle.id}/${bundle.archivedAt ? "restore" : "archive"}`);
      onChanged(bundle.archivedAt ? "restored" : "archived");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await apiClient.delete(`/catalog-bundles/${bundle.id}`);
      setConfirmOpen(false);
      onChanged("deleted");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${bundle.name}`} disabled={busy}>
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onSelect={() => onEdit(bundle)}>
              <MENU_ICONS.edit aria-hidden />
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem onSelect={toggleArchived}>
              {bundle.archivedAt ? <MENU_ICONS.restore aria-hidden /> : <MENU_ICONS.archive aria-hidden />}
              {bundle.archivedAt ? "Restore" : "Archive"}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
                <MENU_ICONS.delete aria-hidden />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{bundle.name}”?</AlertDialogTitle>
            <AlertDialogDescription>The bundle is removed from the catalogue and the item picker. Quotes and invoices that used it keep their lines.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={remove} disabled={busy}>
              Delete bundle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditBundleDialog({ bundle, onClose, onSaved }: { bundle: CatalogBundle | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bundle) return;
    setName(bundle.name);
    setDescription(bundle.description ?? "");
    setNameError(undefined);
    setError(null);
  }, [bundle]);

  async function save() {
    if (!bundle) return;
    if (!name.trim()) {
      setNameError(BUNDLE_NAME_REQUIRED);
      return;
    }
    setSaving(true);
    try {
      await apiClient.put(`/catalog-bundles/${bundle.id}`, { name: name.trim(), description: description.trim() || null });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the bundle.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!bundle} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit bundle</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label="Bundle name" errorText={nameError}>
            {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label="Description" helperText="Its lines stay as they were saved; save a quote's lines again to make a new version.">
            {(field) => <Textarea {...field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
