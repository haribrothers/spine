"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Plus, Sparkles } from "lucide-react";
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
  Button,
  Card,
  FormField,
  Input,
  Spinner,
  cn,
} from "@spine/ui";
import {
  FILE_TOO_LARGE,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_RECORD,
  TOO_MANY_ATTACHMENTS,
  formatFileSize,
  type Attachment,
  type AttachmentEntityType,
  type AttachmentList,
} from "@spine/shared";
import { apiClient } from "../lib/api-client";
import { PHOTO_OR_PDF_ACCEPT } from "../lib/upload-types";
import { useToast } from "./toast-host";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** A file uploaded for a record that hasn't been saved yet; attached once it has an id. */
export interface PendingAttachment {
  fileId: string;
  name: string;
  size: number;
  contentType: string;
}

export function fileUrl(fileId: string, download = false): string {
  return `${API_URL}/files/${fileId}${download ? "?download=1" : ""}`;
}

/** Attaches files uploaded before the record existed (e.g. the "New bill" form), once it's saved. */
export async function attachPending(entityType: AttachmentEntityType, entityId: string, pending: PendingAttachment[]): Promise<void> {
  for (const file of pending) await apiClient.post("/attachments", { entityType, entityId, fileId: file.fileId });
}

function FileBadge({ contentType, fileId, name }: { contentType: string; fileId?: string; name: string }) {
  const isImage = contentType.startsWith("image/") && contentType !== "image/heic";
  if (isImage && fileId) {
    return <img src={fileUrl(fileId)} alt="" className="h-10 w-10 shrink-0 rounded-sm border border-border object-cover" />;
  }
  const label = contentType === "application/pdf" ? "PDF" : (name.split(".").pop() ?? "").toUpperCase().slice(0, 4);
  return (
    <span aria-hidden="true" className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-[11px] font-semibold", contentType === "application/pdf" ? "bg-overdue-bg text-overdue" : "bg-surface-sunken text-on-surface-muted")}>
      {label || <FileText size={16} />}
    </span>
  );
}

/** How a locked record is named in the remove dialog: "This bill is recorded, …". */
const LOCKED_AS: Partial<Record<AttachmentEntityType, [noun: string, state: string]>> = {
  quote: ["quote", "sent"],
  invoice: ["invoice", "issued"],
  credit_note: ["credit note", "issued"],
  payment: ["payment", "recorded"],
  vendor_bill: ["bill", "recorded"],
  vendor_credit: ["vendor credit", "recorded"],
  vendor_payment: ["vendor payment", "recorded"],
  expense: ["expense", "reviewed"],
  bank_transaction: ["entry", "recorded"],
};

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * US-OPS-33 (D-156) — "Attachments" on a record: the files kept with it,
 * "Add files" and a drop zone. Up to 10 files of up to 10 MB each, PDF,
 * JPEG, PNG, WebP or HEIC. With `entityId` null (a record not saved yet)
 * files are uploaded and held in `pending` until the parent saves.
 */
/** US-AI-08 — the files AI can read: PDFs and the photo types every provider takes (not HEIC). */
const AI_READABLE = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export function AttachmentsSection({
  entityType,
  entityId,
  pending,
  onPendingChange,
  onCountChange,
  onRead,
  readBusy = false,
}: {
  entityType: AttachmentEntityType;
  entityId: string | null;
  pending?: PendingAttachment[];
  onPendingChange?: (files: PendingAttachment[]) => void;
  onCountChange?: (count: number) => void;
  /** US-AI-08 — "Read" on a PDF or photo, to fill the record in from it with AI. */
  onRead?: (file: { fileId: string; name: string }) => void;
  /** An AI read is running: "Read" waits for it. */
  readBusy?: boolean;
}) {
  const [data, setData] = useState<AttachmentList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const showToast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isPending = entityId === null;

  const load = useCallback(() => {
    if (!entityId) return;
    apiClient
      .get<AttachmentList>(`/attachments?entityType=${entityType}&entityId=${entityId}`)
      .then((res) => {
        setData(res);
        onCountChange?.(res.attachments.length);
      })
      .catch(() => setData(null));
    // onCountChange is a setter from the parent.
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const count = isPending ? (pending?.length ?? 0) : (data?.attachments.length ?? 0);
  const canAdd = isPending || Boolean(data?.canAdd);

  async function addFiles(list: FileList | File[]) {
    setError(null);
    const chosen = [...list];
    if (!chosen.length) return;
    if (count + chosen.length > MAX_ATTACHMENTS_PER_RECORD) {
      setError(TOO_MANY_ATTACHMENTS);
      return;
    }
    if (chosen.some((f) => f.size > MAX_ATTACHMENT_BYTES)) {
      setError(FILE_TOO_LARGE);
      return;
    }
    setUploading(true);
    try {
      const added: PendingAttachment[] = [];
      for (const file of chosen) {
        const stored = await apiClient.upload<{ id: string; originalFilename: string; sizeBytes: number; mimeType: string }>("/files", file);
        if (isPending) added.push({ fileId: stored.id, name: stored.originalFilename, size: Number(stored.sizeBytes), contentType: stored.mimeType });
        else await apiClient.post<Attachment>("/attachments", { entityType, entityId, fileId: stored.id });
      }
      if (isPending) onPendingChange?.([...(pending ?? []), ...added]);
      else load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add this file. Try again.");
      if (!isPending) load();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const withReason = !isPending && Boolean(data?.canRemoveWithReason);
  const canRemove = isPending || Boolean(data?.canRemove) || withReason;
  const [noun, state] = LOCKED_AS[entityType] ?? ["record", "locked"];

  function startRemove(id: string, name: string) {
    setError(null);
    if (isPending) {
      onPendingChange?.((pending ?? []).filter((p) => p.fileId !== id));
      return;
    }
    setReason("");
    setRemoving({ id, name });
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await apiClient.delete(`/attachments/${removing.id}`, withReason ? { reason: reason.trim() } : {});
      showToast("Attachment removed", `${removing.name} is no longer attached.`);
      setRemoving(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove this file. Try again.");
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  // Readers who can't add files see the section only when there's something in it.
  if (!isPending && data && !data.canAdd && data.attachments.length === 0) return null;

  const rows = isPending
    ? (pending ?? []).map((p) => ({ key: p.fileId, removeId: p.fileId, fileId: p.fileId, name: p.name, contentType: p.contentType, meta: `${formatFileSize(p.size)} · added when you save` }))
    : (data?.attachments ?? []).map((a) => ({
        key: a.id,
        removeId: a.id,
        fileId: a.file.id,
        name: a.file.name,
        contentType: a.file.contentType,
        meta: `${formatFileSize(a.file.size)} · added by ${a.createdBy?.name ?? "someone"} · ${when(a.createdAt)}`,
      }));

  return (
    <Card className="flex flex-col gap-3" data-testid="attachments">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-on-surface">Attachments</h2>
        {canAdd && (
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading || count >= MAX_ATTACHMENTS_PER_RECORD}>
            {uploading ? <Spinner size="sm" /> : <Plus size={14} aria-hidden="true" />}
            Add files
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!isPending && !data ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0">
              <FileBadge contentType={row.contentType} fileId={row.fileId} name={row.name} />
              <div className="min-w-0 flex-1">
                {isPending ? (
                  <p className="truncate text-[14px] font-medium text-on-surface">{row.name}</p>
                ) : (
                  <a href={fileUrl(row.fileId)} target="_blank" rel="noreferrer" className="block truncate text-[14px] font-medium text-primary hover:underline">
                    {row.name}
                  </a>
                )}
                <p className="text-[12px] text-on-surface-muted">{row.meta}</p>
              </div>
              {onRead && AI_READABLE.has(row.contentType) && (
                <button
                  type="button"
                  disabled={readBusy}
                  onClick={() => onRead({ fileId: row.fileId, name: row.name })}
                  className="inline-flex min-h-11 items-center gap-1 px-2 text-[13px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 sm:min-h-0"
                  aria-label={`Read ${row.name} with AI`}
                >
                  <Sparkles size={13} aria-hidden="true" />
                  Read
                </button>
              )}
              {!isPending && (
                <a href={fileUrl(row.fileId, true)} className="inline-flex min-h-11 items-center px-2 text-[13px] font-medium text-primary hover:underline sm:min-h-0" aria-label={`Download ${row.name}`}>
                  Download
                </a>
              )}
              {canRemove && (
                <button
                  type="button"
                  onClick={() => startRemove(row.removeId, row.name)}
                  className="inline-flex min-h-11 items-center px-2 text-[13px] font-medium text-overdue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-0"
                  aria-label={`Remove ${row.name}`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <label
          className={cn(
            "flex cursor-pointer flex-wrap items-center justify-center gap-1 rounded-md border border-dashed px-4 py-5 text-center text-[13px] text-on-surface-muted transition-colors focus-within:ring-2 focus-within:ring-primary",
            dragActive ? "border-primary bg-surface-sunken" : "border-border-strong hover:border-primary",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            void addFiles(e.dataTransfer.files);
          }}
        >
          <Paperclip size={14} aria-hidden="true" />
          <span>
            Drop files here or <span className="font-medium text-primary">add files</span> · PDF, JPEG, PNG, WebP or HEIC, up to 10 MB each, 10 per record
          </span>
          <input ref={inputRef} type="file" multiple accept={PHOTO_OR_PDF_ACCEPT} className="sr-only" aria-label="Choose files to attach" onChange={(e) => e.target.files && void addFiles(e.target.files)} />
        </label>
      )}
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {withReason
                ? `This ${noun} is ${state}, so only an owner can remove its files, with a reason. The ${noun}'s history records it.`
                : "The file is deleted from Spine. The record's history notes that it was removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {withReason && (
            <FormField label="Reason" required>
              {(field) => <Input {...field} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />}
            </FormField>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={busy || (withReason && !reason.trim())}
              onClick={(e) => {
                e.preventDefault();
                void confirmRemove();
              }}
            >
              Remove attachment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** The paperclip on list rows: "3 attachments". */
export function AttachmentCount({ count }: { count: number | undefined }) {
  if (!count) return null;
  const label = `${count} ${count === 1 ? "attachment" : "attachments"}`;
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] text-on-surface-muted" aria-label={label} title={label}>
      <Paperclip size={12} aria-hidden="true" />
      {count}
    </span>
  );
}
