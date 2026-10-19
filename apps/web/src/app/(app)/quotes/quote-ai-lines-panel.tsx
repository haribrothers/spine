"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button, Checkbox, Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerBody, FormField, Textarea, cn } from "@spine/ui";
import { AI_ENQUIRY_MAX, aiPausedMessage, type AiQuoteLines, type CatalogBundle } from "@spine/shared";
import { AiActionButton } from "../../../components/ai-action-button";
import { AiSuggestedTag } from "../../../components/ai-suggested-tag";
import { AiUnavailableNotice } from "../../../components/ai-unavailable-notice";
import { apiClient } from "../../../lib/api-client";
import { useAiRequest } from "../../../lib/use-ai-request";
import { formatMoney } from "../../../lib/money";
import { proposedLineView } from "./quote-ai-lines";
import type { CatalogItemOption } from "./types";

/**
 * US-AI-13 (D-172) — "Draft lines with AI": a side panel where the person
 * pastes the enquiry, AI proposes lines matched to the catalogue, and the
 * ticked ones are added to the quote. Closing without adding changes
 * nothing; the enquiry and proposal stay while the quote is open.
 */
export function QuoteAiLinesPanel({
  currency,
  quoteId,
  catalogItems,
  bundles,
  pausedUntil,
  onAdd,
}: {
  currency: string;
  quoteId?: string;
  catalogItems: CatalogItemOption[];
  bundles: CatalogBundle[];
  pausedUntil: string | null;
  onAdd: (lines: AiQuoteLines["lines"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<AiQuoteLines | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const ai = useAiRequest<AiQuoteLines>();

  function draft() {
    const enquiry = text.trim();
    if (!enquiry) return;
    void ai.run(
      (signal) => apiClient.post<AiQuoteLines>("/ai/draft-quote-lines", { text: enquiry, currency, ...(quoteId ? { quoteId } : {}) }, { signal }),
      (answer) => {
        setResult(answer);
        setTicked(new Set(answer.lines.map((_, i) => i)));
      },
    );
  }

  function add() {
    if (!result) return;
    onAdd(result.lines.filter((_, i) => ticked.has(i)));
    setResult(null);
    setTicked(new Set());
    setOpen(false);
  }

  const lines = result?.lines ?? [];
  const allTicked = lines.length > 0 && ticked.size === lines.length;
  const toggle = (index: number, on: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(index);
      else next.delete(index);
      return next;
    });

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} className="border-primary/40 bg-info-bg/50 text-primary">
        <Sparkles size={14} aria-hidden /> Draft lines with AI
      </Button>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (!next) ai.cancel();
          setOpen(next);
        }}
      >
        <DrawerContent size="md" data-testid="quote-ai-panel">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Sparkles size={16} aria-hidden className="text-primary" /> Draft lines with AI
            </DrawerTitle>
            <DrawerDescription>Paste the enquiry or describe the work. Lines are matched to your catalogue; nothing changes until you add them.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="flex flex-col gap-4">
            <FormField label="Enquiry" helperText={pausedUntil ? aiPausedMessage(pausedUntil) : undefined}>
              {(field) => <Textarea {...field} rows={6} maxLength={AI_ENQUIRY_MAX} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the customer's message, or describe the work" />}
            </FormField>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <AiActionButton
                label={result ? "Draft again" : "Draft lines"}
                workingLabel="Drafting…"
                working={ai.working}
                disabled={!text.trim() || Boolean(pausedUntil)}
                onClick={draft}
                onCancel={ai.cancel}
              />
              {result && !ai.working && (
                <span className="text-[12.5px] text-on-surface-muted">
                  Drafted from the enquiry and {result.candidates} catalogue item{result.candidates === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {ai.state.status === "failed" && <AiUnavailableNotice message={ai.state.message} detail="The quote is as it was." onRetry={ai.state.canRetry ? ai.retry : undefined} />}

            {result && (
              <section aria-label="Proposed lines" className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13.5px] font-semibold text-on-surface">Proposed lines</h3>
                  {lines.length > 0 && <AiSuggestedTag />}
                </div>
                {lines.length === 0 ? (
                  <p className="text-[13px] text-on-surface-muted">AI found nothing to add from this enquiry. Add more detail, or describe the work, and draft again.</p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-border">
                    <div className="grid grid-cols-[28px_minmax(0,1fr)_44px_96px] items-center gap-2 border-b border-border bg-surface-sunken px-3 py-2 text-[12px] font-medium text-on-surface-muted">
                      <Checkbox
                        aria-label="Tick all lines"
                        checked={allTicked ? true : ticked.size > 0 ? "indeterminate" : false}
                        onCheckedChange={(v) => setTicked(v === true ? new Set(lines.map((_, i) => i)) : new Set())}
                      />
                      <span>Line</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Price</span>
                    </div>
                    {lines.map((line, index) => {
                      const view = proposedLineView(line, { catalogItems, bundles, currency });
                      return (
                        <label
                          key={index}
                          className={cn("grid cursor-pointer grid-cols-[28px_minmax(0,1fr)_44px_96px] items-start gap-2 border-b border-border px-3 py-2.5 last:border-b-0", !ticked.has(index) && "text-on-surface-muted")}
                        >
                          <Checkbox aria-label={`Add ${line.name}`} checked={ticked.has(index)} onCheckedChange={(v) => toggle(index, v === true)} className="mt-0.5" />
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-medium">{line.name}</span>
                            <span className={cn("block text-[12px]", view.source === "Not in your catalogue" ? "text-on-surface-muted" : "text-paid")}>{view.source}</span>
                          </span>
                          <span className="text-right text-[13.5px] tabular-nums">{line.quantity}</span>
                          <span className="text-right text-[13.5px] tabular-nums">
                            {view.priceAmount === null ? <span className="font-medium text-due-soon">Add a price</span> : formatMoney(view.priceAmount, currency)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </DrawerBody>
          <DrawerFooter className="items-center">
            {result && lines.length > 0 && (
              <span className="mr-auto text-[13px] text-on-surface-muted">
                {ticked.size} of {lines.length} ticked
              </span>
            )}
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
            {result && lines.length > 0 && (
              <Button type="button" onClick={add} disabled={ticked.size === 0}>
                <Plus size={14} aria-hidden /> Add to quote ({ticked.size})
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
