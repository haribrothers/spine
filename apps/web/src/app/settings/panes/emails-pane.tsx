"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  RichTextEditor,
  Spinner,
  type RichTextEditorHandle,
} from "@spine/ui";
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_PLACEHOLDERS_BY_TYPE,
  emailBodyHtml,
  emailBodyText,
  EMAIL_TEMPLATE_LABELS,
  EMAIL_TEMPLATE_TYPES,
  unknownPlaceholder,
  unknownPlaceholderMessage,
  type EmailTemplateText,
  type EmailTemplateType,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import Link from "next/link";
import type { EmailLogStatusSummary } from "@spine/shared";
import { ScrollText } from "lucide-react";
import { EmailSetupWarning } from "../../(app)/emails/email-setup-warning";
import { SavedToast } from "../saved-toast";

type Templates = Record<EmailTemplateType, EmailTemplateText>;

const firstLine = (body: string) => emailBodyText(body).split("\n").map((l) => l.trim()).find(Boolean) ?? "";
const same = (a: EmailTemplateText, b: EmailTemplateText) => a.subject.trim() === b.subject.trim() && emailBodyHtml(a.body).trim() === emailBodyHtml(b.body).trim();

/**
 * US-SET-21 (D-153) — Settings › Emails: the subject and message of each
 * customer email, with a placeholder menu. The branded layout around them
 * stays the same. Emails already sent don't change.
 */
export function EmailsPane({ onOpenLog }: { onOpenLog?: () => void } = {}) {
  // US-SET-27/29 (D-220): the email log, and whether email is set up.
  const [emailStatus, setEmailStatus] = useState<EmailLogStatusSummary | null>(null);
  const [templates, setTemplates] = useState<Templates | null>(null);
  const [type, setType] = useState<EmailTemplateType>("quote");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // US-SET-22 — preview, a test to myself, and Spine's own words back.
  const [preview, setPreview] = useState<{ subject: string; html: string; source: string } | null>(null);
  const [busy, setBusy] = useState<"preview" | "test" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  // D-189: the message is rich text; placeholders go in through the editor's handle.
  const bodyEditor = useRef<RichTextEditorHandle | null>(null);
  const lastField = useRef<"subject" | "body">("body");
  // Where the cursor goes once an inserted placeholder is on screen.
  const pendingCursor = useRef<{ at: number } | null>(null);

  useLayoutEffect(() => {
    const pending = pendingCursor.current;
    if (!pending) return;
    pendingCursor.current = null;
    subjectRef.current?.focus();
    subjectRef.current?.setSelectionRange(pending.at, pending.at);
  });

  useEffect(() => {
    apiClient
      .get<EmailLogStatusSummary>("/emails/status")
      .then(setEmailStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiClient
      .get<{ value: Partial<Templates> | null }>("/org/settings/email_templates")
      .then((res) =>
        setTemplates(
          Object.fromEntries(
            EMAIL_TEMPLATE_TYPES.map((t) => {
              const text = res.value?.[t] ?? DEFAULT_EMAIL_TEMPLATES[t];
              return [t, { subject: text.subject, body: emailBodyHtml(text.body) }];
            }),
          ) as Templates,
        ),
      )
      .catch(() => setTemplates({ ...DEFAULT_EMAIL_TEMPLATES }));
  }, []);

  if (!templates) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const current = templates[type];
  const subjectError = (() => {
    const name = unknownPlaceholder(current.subject, type);
    return name === null ? (current.subject.trim() ? undefined : "Enter a subject.") : unknownPlaceholderMessage(name);
  })();
  const bodyError = (() => {
    const name = unknownPlaceholder(current.body, type);
    return name === null ? (emailBodyText(current.body) ? undefined : "Enter a message.") : unknownPlaceholderMessage(name);
  })();
  const invalid = EMAIL_TEMPLATE_TYPES.find((t) => {
    const x = templates[t];
    return unknownPlaceholder(x.subject, t) !== null || unknownPlaceholder(x.body, t) !== null || !x.subject.trim() || !emailBodyText(x.body);
  });

  const update = (patch: Partial<EmailTemplateText>) => setTemplates((all) => (all ? { ...all, [type]: { ...all[type], ...patch } } : all));

  /** Puts the placeholder where the cursor was in the subject or message. */
  const insert = (placeholder: string) => {
    const token = `{${placeholder}}`;
    if (lastField.current === "body") {
      bodyEditor.current?.insertText(token);
      return;
    }
    const el = subjectRef.current;
    const value = current.subject;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    pendingCursor.current = { at: start + token.length };
    update({ subject: value.slice(0, start) + token + value.slice(end) });
  };

  async function showPreview() {
    setBusy("preview");
    setError(null);
    try {
      setPreview(await apiClient.post<{ subject: string; html: string; source: string }>(`/org/settings/email_templates/${type}/preview`, current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The preview didn't load. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy("test");
    setError(null);
    setStatus(null);
    try {
      const result = await apiClient.post<{ sentTo: string }>(`/org/settings/email_templates/${type}/test`, current);
      setStatus(`Test sent to ${result.sentTo}. Only you get it.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The test wasn't sent. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function resetToDefault() {
    const next = { ...templates!, [type]: DEFAULT_EMAIL_TEMPLATES[type] };
    setTemplates(next);
    await save(next);
  }

  async function save(all: Templates | null = templates) {
    const templates = all;
    if (!templates) return;
    if (invalid) {
      setType(invalid);
      setError(`Fix the ${EMAIL_TEMPLATE_LABELS[invalid].toLowerCase()} email before saving.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Only the emails that differ from Spine's words are kept; the rest follow the default.
      const value = Object.fromEntries(EMAIL_TEMPLATE_TYPES.filter((t) => !same(templates[t], DEFAULT_EMAIL_TEMPLATES[t])).map((t) => [t, { subject: templates[t].subject.trim(), body: templates[t].body.trim() }]));
      await apiClient.put("/org/settings/email_templates", { value });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The emails weren't saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-on-surface">Emails</h2>
          <p className="text-[13px] text-on-surface-muted">Your own words in the emails customers get. The branded layout around them stays the same.</p>
        </div>
        <Button asChild variant="secondary" size="sm" onClick={onOpenLog}>
          <Link href="/emails">
            <ScrollText size={14} aria-hidden />
            Email log
          </Link>
        </Button>
      </div>
      <EmailSetupWarning status={emailStatus} />

      <div className="grid gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Customer emails">
          <ul className="flex flex-col gap-1" data-testid="email-template-list">
            {EMAIL_TEMPLATE_TYPES.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => setType(t)}
                  aria-current={t === type ? "true" : undefined}
                  className={`flex min-h-11 w-full flex-col items-start rounded-md px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${t === type ? "bg-primary/10" : "hover:bg-surface-sunken"}`}
                >
                  <span className={`text-[14px] ${t === type ? "font-semibold text-primary" : "text-on-surface"}`}>{EMAIL_TEMPLATE_LABELS[t]}</span>
                  <span className="w-full truncate text-[12px] text-on-surface-muted">{templates[t].subject}</span>
                  <span className="w-full truncate text-[12px] text-on-surface-muted">{firstLine(templates[t].body)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-4" data-testid="email-template-editor">
          <FormField label="Subject" errorText={subjectError}>
            {(field) => (
              <Input
                {...field}
                ref={subjectRef}
                value={current.subject}
                maxLength={200}
                required={false}
                onFocus={() => (lastField.current = "subject")}
                onChange={(e) => update({ subject: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Message" helperText="Bold, italics, lists and links show in the email. Web addresses become links." errorText={bodyError}>
            {(field) => (
              <RichTextEditor
                key={type}
                id={field.id}
                aria-describedby={field["aria-describedby"]}
                aria-invalid={field["aria-invalid"]}
                aria-label="Message"
                error={Boolean(bodyError)}
                className="[&_.ProseMirror]:min-h-44"
                value={current.body}
                onValueChange={(body) => update({ body })}
                onFocus={() => (lastField.current = "body")}
                onReady={(handle) => (bodyEditor.current = handle)}
              />
            )}
          </FormField>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Insert a placeholder">
            <span className="text-[13px] font-semibold text-on-surface">Insert</span>
            {EMAIL_PLACEHOLDERS_BY_TYPE[type].map((p) => (
              <button
                key={p}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(p)}
                className="min-h-8 rounded border border-border bg-surface-sunken px-2 font-mono text-[12px] text-on-surface hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {`{${p}}`}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => void showPreview()} disabled={busy !== null || Boolean(subjectError || bodyError)}>
              {busy === "preview" ? <Spinner size="sm" /> : "Preview"}
            </Button>
            <Button variant="secondary" onClick={() => void sendTest()} disabled={busy !== null || Boolean(subjectError || bodyError)}>
              {busy === "test" ? <Spinner size="sm" /> : "Send me a test"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={same(current, DEFAULT_EMAIL_TEMPLATES[type])}>
              Reset to default
            </Button>
          </div>
          <p aria-live="polite" className="text-[13px] text-on-surface-muted">
            {status}
          </p>
        </div>
      </div>

      <p className="text-[13px] text-on-surface-muted">Changes apply to emails sent from now on. Emails already sent don&apos;t change.</p>
      {error && (
        <p role="alert" className="text-[13px] text-overdue">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Spinner size="sm" /> : "Save"}
        </Button>
      </div>
      <SavedToast open={saved} onOpenChange={setSaved} />
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{preview?.subject}</DialogTitle>
            <DialogDescription>
              {preview?.source === "Sample details" ? "Made with sample details — there's no document of this kind yet." : `Made from ${preview?.source}. Nothing is sent.`}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {/* Emails are always light (D-067), so the preview is too. */}
            {preview && <iframe title={`Preview of the ${EMAIL_TEMPLATE_LABELS[type].toLowerCase()} email`} srcDoc={preview.html} sandbox="" className="h-[60vh] w-full rounded-md border border-border bg-white" />}
          </DialogBody>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the {EMAIL_TEMPLATE_LABELS[type].toLowerCase()} email?</AlertDialogTitle>
            <AlertDialogDescription>Spine&apos;s original subject and message come back and are saved. Your other emails keep their words.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my text</AlertDialogCancel>
            <AlertDialogAction onClick={resetToDefault}>Reset to default</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
