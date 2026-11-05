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
import { t as translate, useT } from "../../../lib/i18n";

const STATUS_OPTIONS = [
  { value: "active", label: translate("catalog.common.active") },
  { value: "archived", label: translate("catalog.common.archived") },
];

/**
 * US-QUO-25 — Catalogue › Bundles: the bundles saved from quotes, with
 * their lines and total. Rename needs `catalog.edit_*`; archive, restore
 * and delete need `catalog.delete_*`, own or others by who saved it — the
 * same rules the API applies.
 */
export function BundlesView({ onChooseItems, onCountChange }: { onChooseItems?: () => void; onCountChange?: (active: number) => void } = {}) {
  const t = useT();
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
      .catch((err) => setError(err instanceof Error ? err.message : translate("catalog.bundles.loadError")));
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
      header: t("catalog.bundles.columnBundle"),
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
      header: t("catalog.bundles.columnLines"),
      render: (b) => {
        const items = b.lines.filter((l) => l.type === "item");
        return (
          <span className="text-on-surface-muted">
            {t("catalog.bundles.linesSummary", { count: items.length, names: items.map((l) => l.name).join(", ") })}
          </span>
        );
      },
    },
    {
      key: "total",
      header: t("catalog.common.total"),
      align: "right",
      render: (b) => <span className="tabular-nums">{formatMoney(BigInt(b.totalAmount), b.currency)}</span>,
      sortValue: (b) => BigInt(b.totalAmount),
    },
    {
      key: "status",
      header: t("catalog.common.status"),
      render: (b) => (b.archivedAt ? <Badge>{t("catalog.common.archived")}</Badge> : <Badge className="bg-paid-bg text-paid">{t("catalog.common.active")}</Badge>),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (b) => <BundleRowActions bundle={b} onEdit={setEditing} onChanged={(verb) => (showToast(t(`catalog.bundles.changed.${verb}.title`), t(`catalog.bundles.changed.${verb}.description`, { name: b.name })), load())} />,
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
            title={t("catalog.bundles.emptyTitle")}
            description={t("catalog.bundles.emptyDescription")}
            action={
              onChooseItems ? (
                <Button onClick={onChooseItems}>
                  <ListChecks size={14} aria-hidden />
                  {t("catalog.common.chooseItems")}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="w-56">
            <MultiSelect options={STATUS_OPTIONS} value={statusFilter} onValueChange={setStatusFilter} placeholder={t("catalog.common.allStatuses")} aria-label={t("catalog.common.filterByStatus")} />
          </div>
          <DataTable columns={columns} data={shown} rowKey={(b) => b.id} searchPlaceholder={t("catalog.bundles.searchPlaceholder")} searchKey={(b) => `${b.name} ${b.description ?? ""}`} />
        </>
      )}
      <EditBundleDialog bundle={editing} onClose={() => setEditing(null)} onSaved={() => (showToast(t("catalog.bundles.savedTitle"), t("catalog.bundles.savedDescription")), load())} />
    </div>
  );
}

function BundleRowActions({ bundle, onEdit, onChanged }: { bundle: CatalogBundle; onEdit: (b: CatalogBundle) => void; onChanged: (verb: "archived" | "restored" | "deleted") => void }) {
  const t = useT();
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
          <Button variant="ghost" size="icon" aria-label={t("catalog.common.actionsFor", { name: bundle.name })} disabled={busy}>
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onSelect={() => onEdit(bundle)}>
              <MENU_ICONS.edit aria-hidden />
              {t("catalog.common.edit")}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem onSelect={toggleArchived}>
              {bundle.archivedAt ? <MENU_ICONS.restore aria-hidden /> : <MENU_ICONS.archive aria-hidden />}
              {bundle.archivedAt ? t("catalog.common.restore") : t("catalog.common.archive")}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
                <MENU_ICONS.delete aria-hidden />
                {t("catalog.common.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("catalog.bundles.deleteConfirmTitle", { name: bundle.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("catalog.bundles.deleteConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("catalog.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={remove} disabled={busy}>
              {t("catalog.bundles.deleteButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditBundleDialog({ bundle, onClose, onSaved }: { bundle: CatalogBundle | null; onClose: () => void; onSaved: () => void }) {
  const t = useT();
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
      setError(err instanceof Error ? err.message : t("catalog.bundles.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!bundle} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("catalog.bundles.editTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label={t("catalog.bundles.nameLabel")} errorText={nameError}>
            {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label={t("catalog.common.description")} helperText={t("catalog.bundles.descriptionHelper")}>
            {(field) => <Textarea {...field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t("catalog.common.cancel")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : t("catalog.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
