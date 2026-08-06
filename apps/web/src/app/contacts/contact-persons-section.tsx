"use client";

import { useState } from "react";
import { Button, FormField, Input, Spinner } from "@spine/ui";
import { Trash2 } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import type { Contact, ContactPerson } from "./types";

/**
 * S-01.1 — "hold multiple contact persons." The update endpoint replaces
 * the whole contactPersons array per call (contacts.service.ts's `update`
 * deletes-then-reinserts), so every add/remove here sends the full current
 * list, not an incremental patch.
 */
export function ContactPersonsSection({ contact, onSaved }: { contact: Contact; onSaved: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const people = contact.contactPersons ?? [];

  async function persist(next: Pick<ContactPerson, "name" | "title" | "email" | "phone" | "isPrimary">[]) {
    setSaving(true);
    try {
      await apiClient.put(`/contacts/${contact.id}`, { contactPersons: next });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const next = [...people.map(({ name: n, title: t, email: e, phone: p, isPrimary }) => ({ name: n, title: t, email: e, phone: p, isPrimary })), { name, title: title || null, email: email || null, phone: null, isPrimary: people.length === 0 }];
    await persist(next);
    setName("");
    setTitle("");
    setEmail("");
    setAdding(false);
  }

  async function handleRemove(id: string) {
    const next = people.filter((p) => p.id !== id).map(({ name: n, title: t, email: e, phone: p, isPrimary }) => ({ name: n, title: t, email: e, phone: p, isPrimary }));
    await persist(next);
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[14px] font-semibold text-on-surface">Contact persons</h3>
      {people.length > 0 && (
        <ul className="flex flex-col gap-2">
          {people.map((person) => (
            <li key={person.id} className="flex items-center justify-between rounded-md border border-border-strong px-3 py-2 text-[13px]">
              <div>
                <span className="font-medium text-on-surface">{person.name}</span>
                {person.title && <span className="text-on-surface-muted"> · {person.title}</span>}
                {person.email && <span className="text-on-surface-muted"> · {person.email}</span>}
              </div>
              <button
                type="button"
                aria-label={`Remove ${person.name}`}
                onClick={() => handleRemove(person.id)}
                disabled={saving}
                className="text-on-surface-muted transition-colors hover:text-overdue"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="flex flex-col gap-2 rounded-md border border-border-strong p-3">
          <FormField label="Name" required>
            {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label="Title">
            {(field) => <Input {...field} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </FormField>
          <FormField label="Email">
            {(field) => <Input {...field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </FormField>
          <div className="flex gap-2">
            <Button size="sm" disabled={!name || saving} onClick={handleAdd}>
              {saving ? <Spinner size="sm" /> : "Add"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="self-start" onClick={() => setAdding(true)}>
          Add contact person
        </Button>
      )}
    </section>
  );
}
