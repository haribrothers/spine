"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { apiClient } from "../../lib/api-client";
import type { Contact, ContactType } from "./types";

const TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "vendor", label: "Vendor" },
  { value: "both", label: "Customer & vendor" },
];

/**
 * S-01.1/S-01.2 — create a contact (company or individual, customer/vendor/
 * both). Contact persons and addresses are added afterward from the detail
 * page (they need a contactId to attach to), not in this initial form —
 * keeps the create step to what's required per F1's MUST, matching how the
 * API's create endpoint accepts them optionally but doesn't require them.
 */
export function ContactForm() {
  const router = useRouter();
  const [type, setType] = useState<ContactType>("customer");
  const [isCompany, setIsCompany] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const contact = await apiClient.post<Contact>("/contacts", {
        type,
        isCompany,
        name,
        email: email || undefined,
        phone: phone || undefined,
      });
      router.push(`/contacts/${contact.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create contact.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FormField label="Type" required>
        {(field) => (
          <Select value={type} onValueChange={(v) => setType(v as ContactType)}>
            <SelectTrigger {...field} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      <label className="flex items-center gap-2 text-[13px] text-on-surface">
        <Checkbox checked={isCompany} onCheckedChange={(v) => setIsCompany(v === true)} />
        This is a company, not an individual
      </label>

      <FormField label={isCompany ? "Company name" : "Full name"} required>
        {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} required />}
      </FormField>

      <FormField label="Email">
        {(field) => <Input {...field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </FormField>

      <FormField label="Phone">
        {(field) => <Input {...field} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
      </FormField>

      <Button type="submit" disabled={saving} className="mt-1 self-start">
        {saving ? <Spinner size="sm" /> : "Save contact"}
      </Button>
    </form>
  );
}
