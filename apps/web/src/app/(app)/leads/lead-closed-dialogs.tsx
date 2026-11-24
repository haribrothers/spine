"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Spinner,
  Textarea,
  cn,
} from "@spine/ui";
import { LOST_REASONS, LOST_REASON_LABELS, type LostReason } from "@spine/shared";
import { FilePlus, Trophy } from "lucide-react";
import { formatMoney } from "../../../lib/money";
import { useT } from "../../../lib/i18n";
import type { Lead } from "../contacts/types";

/** US-CRM-26 — the five reasons as chips; pressing the chosen one again clears it. */
export function LostReasonChips({ value, onChange }: { value: LostReason | null; onChange: (reason: LostReason | null) => void }) {
  const t = useT();
  return (
    <div role="group" aria-label={t("leads.closed.reason")} className="flex flex-wrap gap-2">
      {LOST_REASONS.map((reason) => {
        const on = value === reason;
        return (
          <button
            key={reason}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : reason)}
            className={cn(
              "inline-flex min-h-8 items-center rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              on ? "border-primary bg-info-bg font-semibold text-primary" : "border-border-strong bg-surface text-on-surface hover:bg-surface-sunken",
            )}
          >
            {LOST_REASON_LABELS[reason]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * US-CRM-26 (D-211) — after a lead moves to a Lost stage: an optional
 * reason and note. The lead has already moved; "Skip" leaves it without a
 * reason.
 */
export function LeadLostDialog({
  lead,
  contactName,
  onSave,
  onClose,
}: {
  lead: Lead | null;
  contactName: string | null;
  onSave: (reason: LostReason | null, note: string) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const [reason, setReason] = useState<LostReason | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setReason(lead.lostReason);
    setNote(lead.lostNote ?? "");
  }, [lead]);

  async function save() {
    setSaving(true);
    try {
      await onSave(reason, note.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={lead !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("leads.closed.lostTitle")}</DialogTitle>
          {lead && (
            <DialogDescription>
              {[lead.title, contactName, formatMoney(lead.valueAmount, lead.valueCurrency)].filter(Boolean).join(" · ")}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <LostReasonChips value={reason} onChange={setReason} />
          <FormField label={t("leads.closed.note")}>
            {(field) => <Textarea {...field} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("leads.closed.skip")}
          </Button>
          <Button onClick={save} disabled={saving || (!reason && !note.trim())}>
            {saving ? <Spinner size="sm" /> : t("leads.closed.saveReason")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * US-CRM-26 (D-211) — after a lead moves to a Won stage, for someone who
 * may create quotes: start a quote for it, or not now.
 */
export function LeadWonDialog({
  lead,
  contactName,
  ownerName,
  onCreateQuote,
  onClose,
}: {
  lead: Lead | null;
  contactName: string | null;
  ownerName: string | null;
  onCreateQuote: (lead: Lead) => void;
  onClose: () => void;
}) {
  const t = useT();
  const title = lead?.title || contactName || t("leads.closed.thisLead");
  return (
    <Dialog open={lead !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader className="flex flex-row items-start gap-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-paid-bg text-paid">
            <Trophy size={20} />
          </span>
          <div className="flex flex-col gap-1">
            <DialogTitle>{t("leads.closed.wonTitle", { title })}</DialogTitle>
            <DialogDescription>
              {t("leads.closed.wonDescription", { name: contactName ?? t("leads.closed.thisContact") })}
            </DialogDescription>
          </div>
        </DialogHeader>
        {lead && (
          <DialogBody>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border px-3 py-2.5 text-[13px]">
              <dt className="text-on-surface-muted">{t("leads.closed.contact")}</dt>
              <dd className="font-medium text-on-surface">{contactName ?? "—"}</dd>
              <dt className="text-on-surface-muted">{t("leads.closed.value")}</dt>
              <dd className="font-medium tabular-nums text-on-surface">{formatMoney(lead.valueAmount, lead.valueCurrency)}</dd>
              <dt className="text-on-surface-muted">{t("leads.closed.owner")}</dt>
              <dd className="font-medium text-on-surface">{ownerName ?? t("leads.closed.unassigned")}</dd>
            </dl>
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t("leads.closed.notNow")}
          </Button>
          <Button onClick={() => lead && onCreateQuote(lead)}>
            <FilePlus size={14} aria-hidden />
            {t("leads.closed.createQuote")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
