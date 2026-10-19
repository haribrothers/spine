"use client";

import { useCallback, useState } from "react";
import { Check, Loader2, RotateCw, Sparkles, Undo2 } from "lucide-react";
import { Alert, AlertDescription, Button, RichTextContent } from "@spine/ui";
import { aiPausedMessage, emailBodyText, plainTextToHtml, type AiEmailDraft, type DraftEmailInput, type EmailTemplateType } from "@spine/shared";
import { apiClient } from "../lib/api-client";
import { aiFeatureShown, useAiStatus } from "../lib/use-ai-status";
import { useAiRequest } from "../lib/use-ai-request";
import { AiActionButton } from "./ai-action-button";
import { AiUnavailableNotice } from "./ai-unavailable-notice";

/** "this invoice's details" — what each email is about. */
export const EMAIL_DOCUMENT_NOUN: Record<EmailTemplateType, string> = {
  quote: "quote",
  invoice: "invoice",
  reminder: "invoice",
  receipt: "receipt",
  credit_note: "credit note",
  statement: "statement",
};

/** US-AI-11 — the Message's helper text: where the words come from, and what the highlights are. */
export function emailMessageHelp(type: EmailTemplateType | undefined): string {
  const noun = type ? EMAIL_DOCUMENT_NOUN[type] : "document";
  return `Starts from your template in Settings › Emails. Highlighted words are this ${noun}'s details — Spine fills them in. Changes here apply to this email only.`;
}

type Fields = { subject: string; message: string };

/**
 * US-AI-11 (D-171, D-254) — "Draft with AI" for a send dialog. AI's draft
 * arrives as a suggestion and the dialog's fields don't change until
 * "Use this draft"; then each is tagged until it's changed, and "Undo"
 * puts back what they held. The details in a draft are the document's own,
 * filled in by Spine.
 */
export function useEmailAiDraft({ input, fields, apply }: { input: DraftEmailInput | null; fields: Fields; apply: (next: Fields) => void }) {
  const status = useAiStatus();
  const shown = aiFeatureShown(status, "draftEmails");
  const ai = useAiRequest<AiEmailDraft>();
  const { run, cancel } = ai;
  const [suggestion, setSuggestion] = useState<AiEmailDraft | null>(null);
  const [used, setUsed] = useState<{ before: Fields; draft: AiEmailDraft } | null>(null);

  const draft = useCallback(() => {
    if (!input) return;
    void run((signal) => apiClient.post<AiEmailDraft>("/ai/draft-email", input, { signal }), setSuggestion);
  }, [run, input]);

  const useDraft = () => {
    if (!suggestion) return;
    setUsed({ before: fields, draft: suggestion });
    apply({ subject: suggestion.subject, message: suggestion.message });
    setSuggestion(null);
  };

  const undo = () => {
    if (!used) return;
    apply(used.before);
    setUsed(null);
  };

  /** A new email (the dialog opened again): no suggestion, nothing used, nothing running. */
  const reset = useCallback(() => {
    cancel();
    setSuggestion(null);
    setUsed(null);
  }, [cancel]);

  return {
    shown,
    pausedUntil: status?.pausedUntil ?? null,
    ai,
    suggestion,
    used,
    draft,
    useDraft,
    discard: () => setSuggestion(null),
    undo,
    reset,
    /** Tagged "Drafted by AI" until the person changes it. */
    subjectDrafted: Boolean(used && fields.subject === used.draft.subject),
    messageDrafted: Boolean(used && emailBodyText(fields.message) === emailBodyText(used.draft.message)),
  };
}

export type EmailAiDraft = ReturnType<typeof useEmailAiDraft>;

/** Between To and Subject: the button, AI's draft as a suggestion, or — once used — the note with Undo. Nothing when AI can't be used here. */
export function EmailAiDraftBar({ state, type }: { state: EmailAiDraft; type: EmailTemplateType }) {
  if (!state.shown) return null;
  const noun = EMAIL_DOCUMENT_NOUN[type];
  const { ai, suggestion } = state;

  return (
    <div className="flex flex-col gap-3">
      {suggestion ? (
        <section aria-label="AI's draft" data-testid="ai-email-suggestion" className="flex flex-col rounded-md border border-primary/30 bg-info-bg/50">
          <p className="flex items-start gap-2.5 border-b border-primary/20 px-3.5 py-2.5 text-[13px] text-on-surface-muted">
            <Sparkles size={16} aria-hidden className="mt-0.5 shrink-0 text-primary" />
            <span>
              <strong className="font-semibold text-on-surface">AI&apos;s draft</strong> — check it, then use it. Your email below doesn&apos;t change until you do.
            </span>
          </p>
          <div className="flex max-h-80 flex-col gap-2.5 overflow-auto px-3.5 py-3">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-on-surface-muted">Subject</span>
            <RichTextContent className="font-medium [&_p]:my-0" html={plainTextToHtml(suggestion.subject)} highlights={suggestion.values} />
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-on-surface-muted">Message</span>
            <RichTextContent className="rounded-sm border border-border bg-surface px-3 py-2" html={suggestion.message} highlights={suggestion.values} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-primary/20 px-3.5 py-2.5" aria-live="polite">
            <Button type="button" size="sm" onClick={state.useDraft} disabled={ai.working}>
              <Check size={14} aria-hidden />
              Use this draft
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={state.draft} disabled={ai.working} aria-busy={ai.working || undefined}>
              {ai.working ? <Loader2 size={14} aria-hidden className="animate-spin motion-reduce:hidden" /> : <RotateCw size={14} aria-hidden />}
              {ai.working ? "Drafting…" : "Try again"}
            </Button>
            {ai.working ? (
              <Button type="button" size="sm" variant="ghost" onClick={ai.cancel}>
                Cancel
              </Button>
            ) : (
              <Button type="button" size="sm" variant="ghost" onClick={state.discard}>
                Discard
              </Button>
            )}
            <span className="ml-auto text-[12.5px] text-on-surface-muted">Highlighted details are this {noun}&apos;s — AI can&apos;t change them.</span>
          </div>
        </section>
      ) : state.used ? (
        <Alert variant="info" icon={<Sparkles className="text-primary" />} data-testid="ai-email-used">
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex-1">
              <strong className="font-semibold">Using AI&apos;s draft — check it before sending.</strong> The highlighted details are this {noun}&apos;s; edit anything else as you like.
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={state.undo}>
              <Undo2 size={14} aria-hidden />
              Undo
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <AiActionButton label="Draft with AI" workingLabel="Drafting…" working={ai.working} disabled={Boolean(state.pausedUntil)} onClick={state.draft} onCancel={ai.cancel} />
          <span className="text-[12.5px] text-on-surface-muted">{state.pausedUntil ? aiPausedMessage(state.pausedUntil) : "Shows AI's draft first — your email stays as it is."}</span>
        </div>
      )}
      {ai.state.status === "failed" && <AiUnavailableNotice message={ai.state.message} detail="Your email is as it was." onRetry={ai.state.canRetry ? ai.retry : undefined} />}
    </div>
  );
}
