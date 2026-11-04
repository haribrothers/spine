"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button, Checkbox, FormField, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Spinner, Tabs, TabsList, TabsTrigger, Textarea } from "@spine/ui";
import {
  DOCUMENT_NOTES_TOO_LONG,
  DOCUMENT_TERMS_TOO_LONG,
  DOCUMENT_TEXT_MAX,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  LINE_DOCUMENT_TYPES,
  PAPER_SIZES,
  PAPER_SIZE_LABELS,
  documentLayoutSchema,
  resolveDocumentLayout,
  type DocumentColumns,
  type DocumentLayout,
  type DocumentType,
  type DocumentTypeLayout,
  type TaxProfile,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { SavedToast } from "../saved-toast";
import { DocumentSample } from "./document-sample";

const COLUMN_LABELS: { key: keyof DocumentColumns; label: string; gstOnly?: boolean }[] = [
  { key: "quantity", label: "Quantity and unit" },
  { key: "discount", label: "Discount" },
  { key: "hsnSac", label: "HSN/SAC", gstOnly: true },
  { key: "lineTax", label: "Tax per line" },
];


/**
 * US-SET-17 (D-152) — Settings › Documents: per document type, the paper
 * size and the columns, beside a live preview with sample data. Issued
 * PDFs are stored, so changes apply to documents issued from now on.
 * US-SET-18 — the title, and the terms and notes new drafts start with
 * (credit notes, receipts and statements print them as they are). A GST
 * invoice or credit note keeps the title GST requires (US-TAX-15).
 */
export function DocumentsPane() {
  const [layout, setLayout] = useState<DocumentLayout | null>(null);
  const [type, setType] = useState<DocumentType>("invoice");
  const [gst, setGst] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ value: DocumentLayout | null }>("/org/settings/document_layout")
      .then((res) => setLayout(res.value ?? {}))
      .catch(() => setLayout({}));
    apiClient
      .get<TaxProfile>("/org/tax/profile")
      .then((p) => setGst(p.country === "IN" && typeof p.stateCode === "string"))
      .catch(() => {});
  }, []);

  if (!layout) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const current = resolveDocumentLayout(layout, type);
  // From the latest state, so two changes in a row (upload, then tick) both stick.
  const update = (patch: DocumentTypeLayout) => setLayout((l) => (l ? { ...l, [type]: { ...l[type], ...patch } } : l));

  async function save() {
    const parsed = documentLayoutSchema.safeParse(layout);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the options and try again.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.put("/org/settings/document_layout", { value: parsed.data });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the document options.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Documents</h2>
        <p className="text-[13px] text-on-surface-muted">Choose what each document shows. The preview updates as you change options.</p>
      </div>

      <Tabs value={type} onValueChange={(v) => setType(v as DocumentType)}>
        <TabsList aria-label="Document type">
          {DOCUMENT_TYPES.map((t) => (
            <TabsTrigger key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <PaperSizeField value={current.paperSize} onChange={(paperSize) => update({ paperSize })} />
            {gst && (type === "invoice" || type === "credit_note") ? (
              <FormField label="Title" helperText="Set by your GST settings">
                {(field) => <Input {...field} value={type === "invoice" ? "Tax Invoice" : "Credit Note"} disabled />}
              </FormField>
            ) : (
              <FormField label="Title" helperText="e.g. Quotation, Tax Invoice, Estimate">
                {(field) => <Input {...field} maxLength={60} value={layout[type]?.title ?? current.title} onChange={(e) => update({ title: e.target.value })} />}
              </FormField>
            )}
            {/* US-QUO-36: new quotes start valid for this many days. */}
            {type === "quote" && (
              <FormField label="Quotes valid for" helperText="Days, 1 to 365. New quotes start with this validity.">
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    step={1}
                    value={layout.quote?.validDays ?? current.validDays}
                    onChange={(e) => update({ validDays: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className="w-32"
                  />
                )}
              </FormField>
            )}
            {/* US-INV-33: invoices are due this many days after they're issued. */}
            {type === "invoice" && (
              <FormField label="Invoices due in" helperText="Days after issue, 0 to 365. 0 is on receipt. Issued invoices without a due date get one from this.">
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={365}
                    step={1}
                    value={layout.invoice?.dueDays ?? current.dueDays}
                    onChange={(e) => update({ dueDays: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className="w-32"
                  />
                )}
              </FormField>
            )}
          </div>
          {LINE_DOCUMENT_TYPES.includes(type) && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted">Columns</legend>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {COLUMN_LABELS.filter((c) => (!c.gstOnly || gst) && !(c.key === "discount" && type === "credit_note")).map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 text-[13px] text-on-surface">
                    <Checkbox checked={current.columns[c.key]} onCheckedChange={(v) => update({ columns: { ...current.columns, [c.key]: v === true } })} />
                    {c.label}
                  </label>
                ))}
              </div>
              <div className="mt-1 flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-on-surface">
                  <Checkbox checked={current.taxSummary} onCheckedChange={(v) => update({ taxSummary: v === true })} />
                  Tax summary table
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-on-surface">
                  <Checkbox checked={current.amountInWords} onCheckedChange={(v) => update({ amountInWords: v === true })} />
                  Amount in words
                </label>
              </div>
            </fieldset>
          )}
          <SignatureOption
            checked={current.signature}
            fileId={layout.signatureFileId ?? null}
            onCheckedChange={(signature) => update({ signature })}
            onFileChange={(signatureFileId) => setLayout((l) => (l ? { ...l, signatureFileId } : l))}
          />
          <FormField
            label="Default terms"
            helperText={type === "quote" || type === "invoice" ? "New drafts start with these; change them on each document." : "Printed on every one."}
            errorText={current.terms.length > DOCUMENT_TEXT_MAX ? DOCUMENT_TERMS_TOO_LONG : undefined}
          >
            {(field) => <Textarea {...field} rows={3} value={current.terms} onChange={(e) => update({ terms: e.target.value })} />}
          </FormField>
          <FormField label="Default notes" errorText={current.notes.length > DOCUMENT_TEXT_MAX ? DOCUMENT_NOTES_TOO_LONG : undefined}>
            {(field) => <Textarea {...field} rows={3} value={current.notes} onChange={(e) => update({ notes: e.target.value })} />}
          </FormField>
        </div>
        {/* D-237: an HTML sample of the document, drawn from the options on screen. */}
        <div className="lg:sticky lg:top-0 lg:self-start">
          <DocumentSample
            type={type}
            title={gst && type === "invoice" ? "Tax Invoice" : gst && type === "credit_note" ? "Credit Note" : (layout[type]?.title ?? current.title)}
            paperSize={current.paperSize}
            columns={current.columns}
            taxSummary={current.taxSummary}
            amountInWords={current.amountInWords}
            signature={current.signature}
            signatureFileId={layout.signatureFileId ?? null}
            terms={current.terms}
            notes={current.notes}
            gst={gst}
          />
        </div>
      </div>

      <p className="text-[13px] text-on-surface-muted">Hidden columns don&apos;t change any amounts. Issued PDFs never change.</p>
      {error && (
        <p role="alert" className="text-[13px] text-overdue">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Spinner size="sm" /> : "Save"}
        </Button>
      </div>
      <SavedToast open={saved} onOpenChange={setSaved} />
    </div>
  );
}

/**
 * US-SET-19 — the signature printed above "Authorised signatory —
 * <business>" on the document types that tick it. One image for all of
 * them: PNG or JPEG.
 */
function SignatureOption({
  checked,
  fileId,
  onCheckedChange,
  onFileChange,
}: {
  checked: boolean;
  fileId: string | null;
  onCheckedChange: (checked: boolean) => void;
  onFileChange: (fileId: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Upload a PNG or JPEG image.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const uploaded = await apiClient.upload<{ id: string }>("/files", file);
      onFileChange(uploaded.id);
      onCheckedChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload the signature.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-on-surface">
        <Checkbox checked={checked && fileId !== null} disabled={fileId === null} onCheckedChange={(v) => onCheckedChange(v === true)} />
        Signature
      </label>
      <p className="text-[12px] text-on-surface-muted">
        {fileId ? "Shown above “Authorised signatory” on the documents that tick it. Issued PDFs keep the one they were issued with." : "Upload a PNG or JPEG of your signature to print it on documents."}
      </p>
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/png,image/jpeg" className="sr-only" aria-label="Signature image" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
          {uploading ? <Spinner size="sm" /> : fileId ? "Replace signature" : "Upload signature"}
        </Button>
        {fileId && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onFileChange(null)}>
            Remove signature
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[12px] text-overdue">
          {error}
        </p>
      )}
    </div>
  );
}

function PaperSizeField({ value, onChange }: { value: string; onChange: (value: (typeof PAPER_SIZES)[number]) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={id}>Paper size</Label>
      <Select value={value} onValueChange={(v) => onChange(v as (typeof PAPER_SIZES)[number])}>
        <SelectTrigger aria-labelledby={id} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAPER_SIZES.map((s) => (
            <SelectItem key={s} value={s}>
              {PAPER_SIZE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

