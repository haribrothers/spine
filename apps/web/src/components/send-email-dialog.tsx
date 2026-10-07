"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Checkbox, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Spinner, Textarea } from "@spine/ui";
import { unknownPlaceholder, unknownPlaceholderMessage, type EmailDraft, type EmailOverride } from "@spine/shared";
import { apiClient } from "../lib/api-client";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * US-SET-21 (D-153) — the "Send" dialog for a customer email: To, Subject
 * and Message start from the email's template with the document's details
 * filled in, and can be changed for this one email. `onSend` gets only what
 * the dialog holds; the caller posts it to the document's send route.
 */
export function SendEmailDialog({
  open,
  onOpenChange,
  title,
  description,
  draftPath,
  sendLabel,
  pdfLabel,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** e.g. `/email-drafts/invoice/<id>`. */
  draftPath: string;
  sendLabel: string;
  /** "Attach the invoice PDF" — shown when the email can carry one. */
  pdfLabel?: string;
  onSend: (email: Required<Pick<EmailOverride, "to" | "subject" | "message">> & { attachPdf: boolean }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachPdf, setAttachPdf] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(null);
    setLoadError(null);
    setError(null);
    setTouched(false);
    setAttachPdf(true);
    apiClient
      .get<EmailDraft>(draftPath)
      .then((d) => {
        setDraft(d);
        setTo(d.to ?? "");
        setSubject(d.subject);
        setMessage(d.message);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "The email didn't load. Try again."));
  }, [open, draftPath]);

  const placeholderError = (text: string) => {
    const name = draft ? unknownPlaceholder(text, draft.type) : null;
    return name === null ? undefined : unknownPlaceholderMessage(name);
  };
  const toError = !to.trim() ? "Enter an email address." : EMAIL.test(to.trim()) ? undefined : "Enter an email address like name@example.com.";
  const subjectError = !subject.trim() ? "Enter a subject." : placeholderError(subject);
  const messageError = !message.trim() ? "Enter a message." : placeholderError(message);

  async function send() {
    setTouched(true);
    if (toError || subjectError || messageError) return;
    setSending(true);
    setError(null);
    try {
      await onSend({ to: to.trim(), subject: subject.trim(), message: message.trim(), attachPdf: draft?.hasPdf ? attachPdf : false });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The email wasn't sent. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {(loadError || error) && (
            <Alert variant="critical">
              <AlertDescription>{loadError ?? error}</AlertDescription>
            </Alert>
          )}
          {!draft && !loadError ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : draft ? (
            <>
              <FormField label="To" required errorText={touched ? toError : undefined}>
                {(field) => <Input {...field} type="email" required={false} value={to} onChange={(e) => setTo(e.target.value)} autoComplete="email" />}
              </FormField>
              <FormField label="Subject" errorText={touched || placeholderError(subject) ? subjectError : undefined}>
                {(field) => <Input {...field} required={false} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />}
              </FormField>
              <FormField label="Message" helperText="Starts from your template in Settings › Emails. Changes here apply to this email only." errorText={touched || placeholderError(message) ? messageError : undefined}>
                {(field) => <Textarea {...field} rows={9} value={message} onChange={(e) => setMessage(e.target.value)} />}
              </FormField>
              {draft.hasPdf && pdfLabel && (
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[14px] text-on-surface">
                  <Checkbox checked={attachPdf} onCheckedChange={(v) => setAttachPdf(v === true)} />
                  {pdfLabel}
                </label>
              )}
            </>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={() => void send()} disabled={!draft || sending}>
            {sending ? <Spinner size="sm" /> : sendLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
