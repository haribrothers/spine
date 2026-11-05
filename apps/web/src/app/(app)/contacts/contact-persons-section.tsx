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
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Spinner,
} from "@spine/ui";
import { Pencil, Trash2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { ContactLogo } from "./contact-logo";
import type { Contact, ContactPerson } from "./types";
import { useT } from "../../../lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** `id` is optional — omitted for a newly-added row not yet sent to the array-replace PUT. */
type PersonInput = { id?: string; name: string; title: string | null; email: string | null; phone: string | null; isPrimary: boolean; logoFileId: string | null };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * S-01.1 — "hold multiple contact persons." The update endpoint replaces
 * the whole contactPersons array per call (contacts.service.ts's `update`
 * deletes-then-reinserts), so every add/remove here sends the full current
 * list, not an incremental patch.
 *
 * The "Add" flow is a Dialog (per the task brief's Issue 4 — was an inline
 * expanding form), and now also supports an optional photo (Issue 5). A new
 * contact person has no id until the array-replace PUT succeeds, so the
 * upload has to happen first: pick a file -> POST /files -> get a fileId ->
 * include that fileId in the array element sent on the same PUT that
 * creates the person. `ContactLogo` is reused as the upload widget by
 * passing it a null fileId/synthetic name and reading its `onUploaded`
 * callback, rather than duplicating the upload mechanics.
 *
 * Edit reuses this exact same Dialog (one `open`/`editingId` pair of state
 * — `editingId === null` means "adding", a set id means "editing that
 * row"), pre-filled from the row's current values and calling `persist()`
 * with that one array element's fields replaced in place rather than
 * appended — not a second form.
 *
 * Gated on `contacts.manage_persons` (user-reported gap) — a single,
 * non-ownership capability, since contact persons have no creator of
 * their own to split "own" from "others" by (see permissions.ts's own
 * description). Independent of `contacts.edit_own`/`edit_others` and of
 * `contacts.manage_addresses` — `ContactsService.update` requires both
 * the base contact-edit ownership check AND this capability whenever the
 * payload includes `contactPersons`.
 */
export function ContactPersonsSection({
  contact,
  onSaved,
  onCreated,
}: {
  contact: Contact;
  onSaved: () => void;
  onCreated?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [logoFileId, setLogoFileId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canManage = useCapability("contacts.manage_persons");

  const people = contact.contactPersons ?? [];

  function toInput(p: ContactPerson): PersonInput {
    return { id: p.id, name: p.name, title: p.title, email: p.email, phone: p.phone, isPrimary: p.isPrimary, logoFileId: p.logoFileId };
  }

  async function persist(next: PersonInput[]) {
    setSaving(true);
    try {
      await apiClient.put(`/contacts/${contact.id}`, { contactPersons: next });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  function openAddDialog() {
    setEditingId(null);
    setName("");
    setTitle("");
    setEmail("");
    setLogoFileId(null);
    setOpen(true);
  }

  function openEditDialog(person: ContactPerson) {
    setEditingId(person.id);
    setName(person.name);
    setTitle(person.title ?? "");
    setEmail(person.email ?? "");
    setLogoFileId(person.logoFileId);
    setOpen(true);
  }

  async function handleSave() {
    const next = editingId
      ? people.map(toInput).map((p) =>
          p.id === editingId ? { ...p, name, title: title || null, email: email || null, logoFileId } : p,
        )
      : [...people.map(toInput), { name, title: title || null, email: email || null, phone: null, isPrimary: people.length === 0, logoFileId }];
    await persist(next);
    setOpen(false);
    if (!editingId) onCreated?.();
  }

  async function handleRemove(id: string) {
    await persist(people.filter((p) => p.id !== id).map(toInput));
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[14px] font-semibold text-on-surface">{t("contacts.persons.heading")}</h3>
      {people.length > 0 && (
        <ul className="flex flex-col gap-2">
          {people.map((person) => (
            <li key={person.id} className="flex items-center justify-between rounded-md border border-border-strong bg-surface px-3 py-2 text-[13px]">
              <div className="flex items-center gap-2">
                <Avatar size="sm" className="h-7 w-7 shrink-0">
                  {person.logoFileId && <AvatarImage src={`${API_URL}/files/${person.logoFileId}`} alt={person.name} />}
                  <AvatarFallback className="text-[11px]">{initials(person.name) || "?"}</AvatarFallback>
                </Avatar>
                <div>
                  <span className="font-medium text-on-surface">{person.name}</span>
                  {person.title && <span className="text-on-surface-muted"> · {person.title}</span>}
                  {person.email && <span className="text-on-surface-muted"> · {person.email}</span>}
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={t("contacts.persons.editAria", { name: person.name })}
                    disabled={saving}
                    onClick={() => openEditDialog(person)}
                    className="text-on-surface-muted transition-colors hover:text-on-surface"
                  >
                    <Pencil size={14} />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("contacts.persons.removeAria", { name: person.name })}
                        disabled={saving}
                        className="text-on-surface-muted transition-colors hover:text-overdue"
                      >
                        <Trash2 size={14} />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("contacts.persons.removeTitle", { name: person.name })}</AlertDialogTitle>
                        <AlertDialogDescription>{t("contacts.persons.removeDescription")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("contacts.common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction variant="danger" onClick={() => handleRemove(person.id)}>{t("contacts.common.remove")}</AlertDialogAction>
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
            {t("contacts.persons.add")}
          </Button>
        )}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("contacts.persons.edit") : t("contacts.persons.add")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <ContactLogo name={name || "?"} fileId={logoFileId} editable onUploaded={(file) => setLogoFileId(file.id)} />
            <FormField label={t("contacts.common.name")} required>
              {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} />}
            </FormField>
            <FormField label={t("contacts.persons.title")}>
              {(field) => <Input {...field} value={title} onChange={(e) => setTitle(e.target.value)} />}
            </FormField>
            <FormField label={t("contacts.common.email")}>
              {(field) => <Input {...field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("contacts.common.cancel")}
            </Button>
            <Button disabled={!name || saving} onClick={handleSave}>
              {saving ? <Spinner size="sm" /> : editingId ? t("contacts.common.saveChanges") : t("contacts.common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
