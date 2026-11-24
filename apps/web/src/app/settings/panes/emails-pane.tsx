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
import { useT } from "../../../lib/i18n";

type Templates = Record<EmailTemplateType, EmailTemplateText>;

/** The preview API names its source this when there's no real document yet (an API value, not copy). */
const SAMPLE_SOURCE = "Sample details";

const firstLine = (body: string) => emailBodyText(body).split("\n").map((l) => l.trim()).find(Boolean) ?? "";
const same = (a: EmailTemplateText, b: EmailTemplateText) => a.subject.trim() === b.subject.trim() && emailBodyHtml(a.body).trim() === emailBodyHtml(b.body).trim();

/**
 * US-SET-21 (D-153) — Settings › Emails: the subject and message of each
 * customer email, with a placeholder menu. The branded layout around them
 * stays the same. Emails already sent don't change.
 */
export function EmailsPane({ onOpenLog }: { onOpenLog?: () => void } = {}) {
  const t = useT();
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
            EMAIL_TEMPLATE_TYPES.map((kind) => {
              const text = res.value?.[kind] ?? DEFAULT_EMAIL_TEMPLATES[kind];
              return [kind, { subject: text.subject, body: emailBodyHtml(text.body) }];
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
    return name === null ? (current.subject.trim() ? undefined : t("settings.emails.subjectRequired")) : unknownPlaceholderMessage(name);
  })();
  const bodyError = (() => {
    const name = unknownPlaceholder(current.body, type);
    return name === null ? (emailBodyText(current.body) ? undefined : t("settings.emails.messageRequired")) : unknownPlaceholderMessage(name);
  })();
  const invalid = EMAIL_TEMPLATE_TYPES.find((kind) => {
    const x = templates[kind];
    return unknownPlaceholder(x.subject, kind) !== null || unknownPlaceholder(x.body, kind) !== null || !x.subject.trim() || !emailBodyText(x.body);
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
      setError(err instanceof Error ? err.message : t("settings.emails.previewError"));
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
      setStatus(t("settings.emails.testSent", { email: result.sentTo }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.emails.testError"));
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
      setError(t("settings.emails.fixBeforeSaving", { email: EMAIL_TEMPLATE_LABELS[invalid].toLowerCase() }));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Only the emails that differ from Spine's words are kept; the rest follow the default.
      const value = Object.fromEntries(EMAIL_TEMPLATE_TYPES.filter((kind) => !same(templates[kind], DEFAULT_EMAIL_TEMPLATES[kind])).map((kind) => [kind, { subject: templates[kind].subject.trim(), body: templates[kind].body.trim() }]));
      await apiClient.put("/org/settings/email_templates", { value });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.emails.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-on-surface">{t("settings.emails.title")}</h2>
          <p className="text-[13px] text-on-surface-muted">{t("settings.emails.description")}</p>
        </div>
        <Button asChild variant="secondary" size="sm" onClick={onOpenLog}>
          <Link href="/emails">
            <ScrollText size={14} aria-hidden />
            {t("settings.emails.emailLog")}
          </Link>
        </Button>
      </div>
      <EmailSetupWarning status={emailStatus} />

      <div className="grid gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label={t("settings.emails.customerEmails")}>
          <ul className="flex flex-col gap-1" data-testid="email-template-list">
            {EMAIL_TEMPLATE_TYPES.map((kind) => (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => setType(kind)}
                  aria-current={kind === type ? "true" : undefined}
                  className={`flex min-h-11 w-full flex-col items-start rounded-md px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${kind === type ? "bg-primary/10" : "hover:bg-surface-sunken"}`}
                >
                  <span className={`text-[14px] ${kind === type ? "font-semibold text-primary" : "text-on-surface"}`}>{EMAIL_TEMPLATE_LABELS[kind]}</span>
                  <span className="w-full truncate text-[12px] text-on-surface-muted">{templates[kind].subject}</span>
                  <span className="w-full truncate text-[12px] text-on-surface-muted">{firstLine(templates[kind].body)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-4" data-testid="email-template-editor">
          <FormField label={t("settings.emails.subject")} errorText={subjectError}>
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
          <FormField label={t("settings.emails.message")} helperText={t("settings.emails.messageHelp")} errorText={bodyError}>
            {(field) => (
              <RichTextEditor
                key={type}
                id={field.id}
                aria-describedby={field["aria-describedby"]}
                aria-invalid={field["aria-invalid"]}
                aria-label={t("settings.emails.message")}
                error={Boolean(bodyError)}
                className="[&_.ProseMirror]:min-h-44"
                value={current.body}
                onValueChange={(body) => update({ body })}
                onFocus={() => (lastField.current = "body")}
                onReady={(handle) => (bodyEditor.current = handle)}
              />
            )}
          </FormField>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("settings.emails.insertPlaceholder")}>
            <span className="text-[13px] font-semibold text-on-surface">{t("settings.emails.insert")}</span>
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
              {busy === "preview" ? <Spinner size="sm" /> : t("settings.emails.preview")}
            </Button>
            <Button variant="secondary" onClick={() => void sendTest()} disabled={busy !== null || Boolean(subjectError || bodyError)}>
              {busy === "test" ? <Spinner size="sm" /> : t("settings.emails.sendTest")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={same(current, DEFAULT_EMAIL_TEMPLATES[type])}>
              {t("settings.emails.resetToDefault")}
            </Button>
          </div>
          <p aria-live="polite" className="text-[13px] text-on-surface-muted">
            {status}
          </p>
        </div>
      </div>

      <p className="text-[13px] text-on-surface-muted">{t("settings.emails.changesNote")}</p>
      {error && (
        <p role="alert" className="text-[13px] text-overdue">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Spinner size="sm" /> : t("settings.common.save")}
        </Button>
      </div>
      <SavedToast open={saved} onOpenChange={setSaved} />
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{preview?.subject}</DialogTitle>
            <DialogDescription>
              {preview?.source === SAMPLE_SOURCE ? t("settings.emails.previewSample") : t("settings.emails.previewFrom", { source: preview?.source ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {/* Emails are always light (D-067), so the preview is too. */}
            {preview && <iframe title={t("settings.emails.previewTitle", { email: EMAIL_TEMPLATE_LABELS[type].toLowerCase() })} srcDoc={preview.html} sandbox="" className="h-[60vh] w-full rounded-md border border-border bg-white" />}
          </DialogBody>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.emails.resetConfirm.title", { email: EMAIL_TEMPLATE_LABELS[type].toLowerCase() })}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.emails.resetConfirm.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("settings.emails.resetConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={resetToDefault}>{t("settings.emails.resetToDefault")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
