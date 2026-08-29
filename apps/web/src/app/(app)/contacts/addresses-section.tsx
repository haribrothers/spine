"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { Pencil, Trash2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import type { Address, AddressType, Contact } from "./types";

const TYPE_OPTIONS: AddressType[] = ["billing", "shipping", "site", "other"];

/** `id` is optional — omitted for a newly-added row not yet sent to the array-replace PUT. */
type AddressInput = {
  id?: string;
  type: AddressType;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  isPrimary: boolean;
};

/**
 * S-01.1 — "hold multiple addresses." Same whole-array-replace pattern as
 * ContactPersonsSection. "Add" is a Dialog (Issue 4) — its Select (address
 * type) is this section's own live exercise of the Select-inside-Dialog
 * z-index fix (Issue 3). Edit reuses the same Dialog, pre-filled, keyed off
 * `editingId` the same way ContactPersonsSection does.
 *
 * Gated on `contacts.manage_addresses` (user-reported gap) — same
 * single-non-ownership-capability reasoning as ContactPersonsSection's own
 * `contacts.manage_persons`, independent of it and of
 * `contacts.edit_own`/`edit_others`.
 */
export function AddressesSection({
  contact,
  onSaved,
  onCreated,
}: {
  contact: Contact;
  onSaved: () => void;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<AddressType>("billing");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const canManage = useCapability("contacts.manage_addresses");

  const addresses = contact.addresses ?? [];

  function toInput(a: Address): AddressInput {
    return { id: a.id, type: a.type, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode, country: a.country, isPrimary: a.isPrimary };
  }

  async function persist(next: AddressInput[]) {
    setSaving(true);
    try {
      await apiClient.put(`/contacts/${contact.id}`, { addresses: next });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  function openAddDialog() {
    setEditingId(null);
    setType("billing");
    setLine1("");
    setCity("");
    setOpen(true);
  }

  function openEditDialog(address: Address) {
    setEditingId(address.id);
    setType(address.type);
    setLine1(address.line1);
    setCity(address.city ?? "");
    setOpen(true);
  }

  async function handleSave() {
    const next = editingId
      ? addresses.map(toInput).map((a) => (a.id === editingId ? { ...a, type, line1, city: city || null } : a))
      : [...addresses.map(toInput), { type, line1, line2: null, city: city || null, state: null, postalCode: null, country: null, isPrimary: addresses.length === 0 }];
    await persist(next);
    setOpen(false);
    if (!editingId) onCreated?.();
  }

  async function handleRemove(id: string) {
    await persist(addresses.filter((a) => a.id !== id).map(toInput));
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[14px] font-semibold text-on-surface">Addresses</h3>
      {addresses.length > 0 && (
        <ul className="flex flex-col gap-2">
          {addresses.map((address) => (
            <li key={address.id} className="flex items-center justify-between rounded-md border border-border-strong px-3 py-2 text-[13px]">
              <div>
                <span className="font-medium capitalize text-on-surface">{address.type}</span>
                <span className="text-on-surface-muted">
                  {" "}
                  · {address.line1}
                  {address.city ? `, ${address.city}` : ""}
                </span>
              </div>
              {canManage && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Edit address"
                    disabled={saving}
                    onClick={() => openEditDialog(address)}
                    className="text-on-surface-muted transition-colors hover:text-on-surface"
                  >
                    <Pencil size={14} />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        aria-label="Remove address"
                        disabled={saving}
                        className="text-on-surface-muted transition-colors hover:text-overdue"
                      >
                        <Trash2 size={14} />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this address?</AlertDialogTitle>
                        <AlertDialogDescription>This removes the address from this contact. This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemove(address.id)}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        {canManage && (
          <Button size="sm" variant="secondary" className="self-start" onClick={openAddDialog}>
            Add address
          </Button>
        )}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit address" : "Add address"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <FormField label="Type">
              {(field) => (
                <Select value={type} onValueChange={(v) => setType(v as AddressType)}>
                  <SelectTrigger {...field} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        <span className="capitalize">{t}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label="Address line" required>
              {(field) => <Input {...field} value={line1} onChange={(e) => setLine1(e.target.value)} />}
            </FormField>
            <FormField label="City">
              {(field) => <Input {...field} value={city} onChange={(e) => setCity(e.target.value)} />}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!line1 || saving} onClick={handleSave}>
              {saving ? <Spinner size="sm" /> : editingId ? "Save changes" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
