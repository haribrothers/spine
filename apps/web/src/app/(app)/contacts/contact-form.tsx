"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  AlertDescription,
  Checkbox,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@spine/ui";
import type { GstTreatment } from "@spine/shared";
import { ContactGstFields, contactGstError, useTaxCountry } from "./contact-gst-fields";
import { apiClient } from "../../../lib/api-client";
import { ContactLogo } from "./contact-logo";
import type { Contact, ContactType, SpineFile } from "./types";
import { useToast } from "../../../components/toast-host";

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
 *
 * Only ever rendered inside the list page's create Drawer now
 * (contact-create-drawer.tsx) — `/contacts/new` just redirects into it. The
 * submit button lives in the Drawer's own sticky DrawerFooter, not in this
 * form's markup: the form has `id={formId}` and the footer's Save button
 * references it via the standard HTML `form="..."` attribute, so a button
 * physically outside the scrollable body can still submit it.
 *
 * The logo upload reuses `ContactLogo` exactly as contact-persons-section.tsx
 * does for a new person: the contact doesn't have an id yet, so the file is
 * uploaded independently up front and its id is held in local state, then
 * included in the create payload once the rest of the form is submitted —
 * not attached via a follow-up PUT the way an existing contact's logo is.
 */
export function ContactForm({ formId, onSubmittingChange, onSuccess }: { formId: string; onSubmittingChange?: (saving: boolean) => void; onSuccess?: (contact: Contact) => void }) {
  const router = useRouter();
  const showToast = useToast();
  const [type, setType] = useState<ContactType>("customer");
  const [isCompany, setIsCompany] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  // US-TAX-12 — GST treatment and GSTIN for an Indian business.
  const taxCountry = useTaxCountry();
  const [gstTreatment, setGstTreatment] = useState<GstTreatment | null>(null);
  const [stateCode, setStateCode] = useState<string | null>(null);
  const [showGstErrors, setShowGstErrors] = useState(false);
  const [website, setWebsite] = useState("");
  const [logoFileId, setLogoFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (taxCountry === "IN" && contactGstError(gstTreatment, taxId, stateCode)) {
      setShowGstErrors(true);
      return;
    }
    onSubmittingChange?.(true);
    setError(null);
    try {
      const contact = await apiClient.post<Contact>("/contacts", {
        type,
        isCompany,
        name,
        email: email || undefined,
        phone: phone || undefined,
        taxId: taxId || undefined,
        gstTreatment: taxCountry === "IN" ? (gstTreatment ?? undefined) : undefined,
        stateCode: taxCountry === "IN" ? (stateCode ?? undefined) : undefined,
        website: website || undefined,
        logoFileId: logoFileId || undefined,
      });
      if (onSuccess) {
        onSuccess(contact);
        return;
      }
      // The app's toast host stays mounted, so it shows on the contact's page (D-223).
      showToast("Contact created", `${contact.name} has been added to your contacts.`);
      router.push(`/contacts/${contact.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create contact.");
      onSubmittingChange?.(false);
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ContactLogo
        name={name || "New contact"}
        fileId={logoFileId}
        editable
        onUploaded={(file: SpineFile) => setLogoFileId(file.id)}
      />

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

      {taxCountry === "IN" ? (
        <ContactGstFields
                treatment={gstTreatment}
                gstin={taxId}
                stateCode={stateCode}
                onTreatmentChange={setGstTreatment}
                onGstinChange={setTaxId}
                onStateCodeChange={setStateCode}
                showErrors={showGstErrors}
              />
      ) : (
        <FormField label="Tax ID" helperText="Useful for invoicing a business contact.">
          {(field) => <Input {...field} value={taxId} onChange={(e) => setTaxId(e.target.value)} />}
        </FormField>
      )}

      <FormField label="Website">
        {(field) => <Input {...field} type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />}
      </FormField>
    </form>
  );
}
