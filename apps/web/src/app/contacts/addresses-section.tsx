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
import { Trash2 } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import type { Address, AddressType, Contact } from "./types";

const TYPE_OPTIONS: AddressType[] = ["billing", "shipping", "site", "other"];

/**
 * S-01.1 — "hold multiple addresses." Same whole-array-replace pattern as
 * ContactPersonsSection. "Add" is a Dialog (Issue 4) — its Select (address
 * type) is this section's own live exercise of the Select-inside-Dialog
 * z-index fix (Issue 3).
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
  const [type, setType] = useState<AddressType>("billing");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  const addresses = contact.addresses ?? [];

  function toInput(a: Address) {
    return { type: a.type, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode, country: a.country, isPrimary: a.isPrimary };
  }

  async function persist(next: ReturnType<typeof toInput>[]) {
    setSaving(true);
    try {
      await apiClient.put(`/contacts/${contact.id}`, { addresses: next });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const next = [...addresses.map(toInput), { type, line1, line2: null, city: city || null, state: null, postalCode: null, country: null, isPrimary: addresses.length === 0 }];
    await persist(next);
    setLine1("");
    setCity("");
    setType("billing");
    setOpen(false);
    onCreated?.();
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
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <Button size="sm" variant="secondary" className="self-start" onClick={() => setOpen(true)}>
          Add address
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add address</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
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
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!line1 || saving} onClick={handleAdd}>
              {saving ? <Spinner size="sm" /> : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
