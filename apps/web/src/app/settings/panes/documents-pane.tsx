"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Spinner, Tabs, TabsList, TabsTrigger } from "@spine/ui";
import {
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

const COLUMN_LABELS: { key: keyof DocumentColumns; label: string; gstOnly?: boolean }[] = [
  { key: "quantity", label: "Quantity and unit" },
  { key: "discount", label: "Discount" },
  { key: "hsnSac", label: "HSN/SAC", gstOnly: true },
  { key: "lineTax", label: "Tax per line" },
];

/** The unsaved layout as the preview route reads it: base64url JSON. */
function encodeLayout(layout: DocumentLayout): string {
  const bytes = new TextEncoder().encode(JSON.stringify(layout));
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * US-SET-17 (D-152) — Settings › Documents: per document type, the paper
 * size and the columns, beside a live preview with sample data. Issued
 * PDFs are stored, so changes apply to documents issued from now on.
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
  const update = (patch: DocumentTypeLayout) => setLayout({ ...layout, [type]: { ...layout[type], ...patch } });

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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="flex flex-col gap-4">
          <PaperSizeField value={current.paperSize} onChange={(paperSize) => update({ paperSize })} />
          {LINE_DOCUMENT_TYPES.includes(type) && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted">Columns</legend>
              <div className="grid grid-cols-2 gap-2">
                {COLUMN_LABELS.filter((c) => (!c.gstOnly || gst) && !(c.key === "discount" && type === "credit_note")).map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 text-[13px] text-on-surface">
                    <Checkbox checked={current.columns[c.key]} onCheckedChange={(v) => update({ columns: { ...layout[type]?.columns, [c.key]: v === true } })} />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
        <DocumentPreview type={type} layout={layout} />
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

/** A sample PDF with the unsaved options, refreshed shortly after each change. */
function DocumentPreview({ type, layout }: { type: DocumentType; layout: DocumentLayout }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const previous = useRef<string | null>(null);
  const query = useMemo(() => `type=${type}&layout=${encodeLayout(layout)}`, [type, layout]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      apiClient
        .download(`/org/settings/document_layout/preview?${query}`)
        .then(({ blob }) => {
          if (cancelled) return;
          const next = URL.createObjectURL(blob);
          if (previous.current) URL.revokeObjectURL(previous.current);
          previous.current = next;
          setUrl(next);
          setFailed(false);
        })
        .catch(() => !cancelled && setFailed(true));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => () => {
    if (previous.current) URL.revokeObjectURL(previous.current);
  }, []);

  return (
    <div className="flex min-h-[320px] flex-col overflow-hidden rounded-md border border-border-strong bg-surface-sunken">
      {url ? (
        <iframe title={`${DOCUMENT_TYPE_LABELS[type]} preview`} src={`${url}#toolbar=0&navpanes=0&view=FitH`} className="h-full min-h-[320px] w-full flex-1 bg-white" />
      ) : (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-[13px] text-on-surface-muted">{failed ? "The preview couldn't load. Your options still save." : <Spinner />}</div>
      )}
    </div>
  );
}
