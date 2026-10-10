"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Combobox,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  FormField,
  Input,
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
  cn,
} from "@spine/ui";
import type { LeadHistoryEntry, LeadStage, LostReason } from "@spine/shared";
import { FilePlus, Trash2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import type { MemberRow } from "../../../lib/members";
import { formatMoney } from "../../../lib/money";
import { ActivitiesSection } from "../contacts/activities-section";
import { STAGE_DOT_CLASS } from "../contacts/use-lead-stages";
import type { Activity, Contact, Lead } from "../contacts/types";
import { QUOTE_STATUS_LABELS, type Quote } from "../quotes/types";
import { STATUS_BADGE_CLASS } from "../quotes/quotes-table";
import { LostReasonChips } from "./lead-closed-dialogs";
import { daysInStage, daysLabel } from "./pipeline-state";

// Same list quote-builder.tsx uses for its currency Combobox.
const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];
const UNASSIGNED = "__unassigned__";

interface CurrencyLocaleValue {
  code: string;
  locale: string;
}

/** Open follow-ups first, soonest due first; then the rest, newest first. */
export function sortFollowUps(activities: Activity[]): Activity[] {
  const open = activities.filter((a) => !a.doneAt && a.dueAt).sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
  const rest = activities.filter((a) => !open.includes(a)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return [...open, ...rest];
}

function historyWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export interface LeadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = an existing lead; null = "Add lead". */
  lead: Lead | null;
  contacts: Contact[];
  leads: Lead[];
  stages: LeadStage[];
  members: MemberRow[];
  /** The stage of the column "Add lead" was pressed from. */
  defaultStageId?: string;
  /** Called after a save with the saved lead and the stage it was in before (null for a new lead). */
  onSaved: (lead: Lead, previousStageId: string | null) => void;
  onDeleteRequest: (lead: Lead) => void;
  onCreateQuote: (lead: Lead) => void;
}

/**
 * US-CRM-27 (D-211) — one drawer for a lead: its details (with owner and
 * expected close date), follow-ups, linked quotes and stage history. A new
 * lead gets the details only; the rest appear once it's saved. Replaces
 * the old lead dialog on the board (the contact page's Leads tab keeps its own).
 */
export function LeadDrawer({ open, onOpenChange, lead, contacts, leads, stages, members, defaultStageId, onSaved, onDeleteRequest, onCreateQuote }: LeadDrawerProps) {
  const [contactId, setContactId] = useState("");
  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState("");
  const [amount, setAmount] = useState(0n);
  const [currency, setCurrency] = useState("USD");
  const [source, setSource] = useState("");
  const [owner, setOwner] = useState(UNASSIGNED);
  const [closeDate, setCloseDate] = useState("");
  const [lostReason, setLostReason] = useState<LostReason | null>(null);
  const [lostNote, setLostNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [history, setHistory] = useState<LeadHistoryEntry[] | null>(null);
  const canEditLead = useCanEditOwnership(lead?.createdByUserId ?? null, { own: "leads.edit_own", others: "leads.edit_others" });
  const canDeleteLead = useCanEditOwnership(lead?.createdByUserId ?? null, { own: "leads.delete_own", others: "leads.delete_others" });
  const canCreate = useCapability("leads.edit_own");
  const canQuote = useCapability("quotes.edit_own");
  const editable = lead ? canEditLead : canCreate;

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (lead) {
      setContactId(lead.contactId);
      setTitle(lead.title ?? "");
      setStageId(lead.stageId);
      setAmount(BigInt(lead.valueAmount));
      setCurrency(lead.valueCurrency);
      setSource(lead.source ?? "");
      setOwner(lead.ownerUserId ?? UNASSIGNED);
      setCloseDate(lead.expectedCloseDate ?? "");
      setLostReason(lead.lostReason);
      setLostNote(lead.lostNote ?? "");
    } else {
      setContactId("");
      setTitle("");
      setStageId(defaultStageId ?? stages.find((s) => s.kind === "open")?.id ?? stages[0]?.id ?? "");
      setAmount(0n);
      setSource("");
      setOwner(UNASSIGNED);
      setCloseDate("");
      setLostReason(null);
      setLostNote("");
      apiClient
        .get<{ key: string; value: CurrencyLocaleValue | null }>("/org/settings/currency")
        .then((res) => {
          if (res.value?.code) setCurrency(res.value.code);
        })
        .catch(() => {});
    }
    // Only when the drawer opens or switches lead — not when the board refreshes the same lead under it.
  }, [open, lead?.id, defaultStageId]);

  const leadId = lead?.id ?? null;
  const loadActivities = useCallback(() => {
    if (!leadId) return;
    apiClient
      .get<Activity[]>(`/activities?leadId=${leadId}`)
      .then((rows) => setActivities(sortFollowUps(rows)))
      .catch(() => setActivities([]));
  }, [leadId]);

  useEffect(() => {
    setActivities(null);
    setQuotes(null);
    setHistory(null);
    if (!open || !leadId) return;
    loadActivities();
    apiClient.get<Quote[]>(`/quotes?leadId=${leadId}`).then(setQuotes).catch(() => setQuotes([]));
    apiClient.get<LeadHistoryEntry[]>(`/leads/${leadId}/history`).then(setHistory).catch(() => setHistory([]));
  }, [open, leadId, loadActivities]);

  const stage = stages.find((s) => s.id === stageId);
  const isLostStage = stage?.kind === "lost";
  const contact = contacts.find((c) => c.id === contactId);
  const creator = lead?.createdByUserId ? members.find((m) => m.userId === lead.createdByUserId)?.name : null;

  const currencyOptions = useMemo(() => {
    const codes = COMMON_CURRENCIES.includes(currency) ? COMMON_CURRENCIES : [currency, ...COMMON_CURRENCIES];
    return codes.map((code) => ({ value: code, label: code }));
  }, [currency]);
  const sourceOptions = useMemo(() => {
    const values = new Set(leads.flatMap((l) => (l.source ? [l.source] : [])));
    if (source) values.add(source);
    return [...values].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
  }, [leads, source]);
  const contactOptions = useMemo(() => contacts.map((c) => ({ value: c.id, label: c.name })), [contacts]);
  // The current owner stays listed even if they've since been deactivated.
  const ownerOptions = useMemo(() => {
    const active = members.filter((m) => m.isActive);
    const current = lead?.ownerUserId ? members.find((m) => m.userId === lead.ownerUserId && !m.isActive) : undefined;
    return [...active, ...(current ? [current] : [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, lead?.ownerUserId]);

  const canSave = editable && contactId.length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const body = {
      contactId,
      title: title.trim() || null,
      stageId,
      valueAmount: amount.toString(),
      valueCurrency: currency,
      source: source || null,
      ownerUserId: owner === UNASSIGNED ? null : owner,
      expectedCloseDate: closeDate || null,
      ...(isLostStage ? { lostReason, lostNote: lostNote.trim() || null } : {}),
    };
    try {
      const saved = lead ? await apiClient.put<Lead>(`/leads/${lead.id}`, body) : await apiClient.post<Lead>("/leads", body);
      onOpenChange(false);
      onSaved(saved, lead?.stageId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the lead. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent size="lg" aria-describedby={lead ? "lead-drawer-summary" : undefined} data-testid="lead-drawer">
        <DrawerHeader className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <DrawerTitle className="min-w-0 truncate text-[18px]">{lead ? lead.title || contact?.name || "Untitled lead" : "Add lead"}</DrawerTitle>
            {lead && stage && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-[12px] font-semibold text-on-surface">
                <span aria-hidden className={cn("h-2 w-2 rounded-full", STAGE_DOT_CLASS[stage.color])} />
                {lead.stageName}
              </span>
            )}
          </div>
          {lead ? (
            <DrawerDescription id="lead-drawer-summary" className="flex flex-wrap items-center gap-x-2">
              {contact && (
                <Link href={`/contacts/${contact.id}`} className="font-medium text-primary hover:underline">
                  {contact.name}
                </Link>
              )}
              <span aria-hidden>·</span>
              <span>{lead.stageKind === "open" ? daysLabel(daysInStage(lead, Date.now())) : `${lead.stageName} ${new Date(lead.stageChangedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}</span>
              {creator && (
                <>
                  <span aria-hidden>·</span>
                  <span>created by {creator}</span>
                </>
              )}
            </DrawerDescription>
          ) : (
            <DrawerDescription>A lead is an opportunity with a contact. You can add follow-ups once it&apos;s saved.</DrawerDescription>
          )}
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-0 divide-y divide-border py-0">
          <section aria-label="Details" className="grid grid-cols-1 gap-x-3.5 gap-y-3 py-4 sm:grid-cols-2">
            <FormField label="Title" className="sm:col-span-2">
              {(field) => <Input {...field} value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} />}
            </FormField>
            <FormField label="Contact">
              {(field) => <Combobox {...field} options={contactOptions} value={contactId} onValueChange={setContactId} placeholder="Select a contact…" disabled={!editable} />}
            </FormField>
            <FormField label="Stage">
              {(field) => (
                <Select value={stageId} onValueChange={setStageId} disabled={!editable}>
                  <SelectTrigger {...field} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label="Estimated value">
              {(field) => <MoneyInput {...field} value={amount} onValueChange={setAmount} currency={currency} disabled={!editable} />}
            </FormField>
            <FormField label="Currency">
              {(field) => <Combobox {...field} options={currencyOptions} value={currency} onValueChange={setCurrency} disabled={!editable} />}
            </FormField>
            <FormField label="Owner">
              {(field) => (
                <Select value={owner} onValueChange={setOwner} disabled={!editable}>
                  <SelectTrigger {...field} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {ownerOptions.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label="Expected close">
              {(field) => <Input {...field} type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} disabled={!editable} />}
            </FormField>
            <FormField label="Source" className="sm:col-span-2">
              {(field) => (
                <Combobox {...field} options={sourceOptions} value={source} onValueChange={setSource} placeholder="Select or type a source…" allowCreate disabled={!editable} />
              )}
            </FormField>
            {isLostStage && (
              <div className="flex flex-col gap-2 sm:col-span-2" data-testid="lead-drawer-lost">
                <span className="text-[13px] font-medium text-on-surface">Why was it lost?</span>
                <LostReasonChips value={lostReason} onChange={setLostReason} />
                <FormField label="Note (optional)">
                  {(field) => <Textarea {...field} value={lostNote} onChange={(e) => setLostNote(e.target.value)} rows={2} maxLength={1000} disabled={!editable} />}
                </FormField>
              </div>
            )}
          </section>

          {lead && (
            <>
              <div className="py-4">
                <ActivitiesSection contactId={lead.contactId} leadId={lead.id} heading="Follow-ups" followUps activities={activities} onChanged={loadActivities} />
              </div>

              <section aria-label="Quotes" className="flex flex-col gap-2.5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[14px] font-semibold text-on-surface">Quotes</h3>
                  {canQuote && (
                    <Button size="sm" variant="secondary" onClick={() => onCreateQuote(lead)}>
                      <FilePlus size={14} aria-hidden />
                      Create quote
                    </Button>
                  )}
                </div>
                {quotes === null ? (
                  <Spinner size="sm" />
                ) : quotes.length === 0 ? (
                  <p className="text-[13px] text-on-surface-muted">No quotes for this lead yet.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {quotes.map((q) => (
                      <li key={q.id} className="flex items-center gap-2.5 py-2 text-[13px]">
                        <Link href={`/quotes/${q.id}`} className="font-medium text-primary hover:underline">
                          {q.number ?? `Draft v${q.version}`}
                        </Link>
                        <Badge className={STATUS_BADGE_CLASS[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Badge>
                        <span className="ml-auto font-medium tabular-nums text-on-surface">{formatMoney(q.totalAmount, q.currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-label="History" className="flex flex-col gap-2 py-4">
                <h3 className="text-[14px] font-semibold text-on-surface">History</h3>
                {history === null ? (
                  <Spinner size="sm" />
                ) : history.length === 0 ? (
                  <p className="text-[13px] text-on-surface-muted">No history yet.</p>
                ) : (
                  <ol className="flex flex-col gap-1" data-testid="lead-history">
                    {history.map((h, i) => (
                      <li key={i} className="flex gap-2.5 py-1 text-[12.5px] text-on-surface-muted">
                        <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border-strong" />
                        <span>
                          {h.kind === "created" ? (
                            <>
                              <b className="font-medium text-on-surface">Created</b>
                              {h.toStage && <> in {h.toStage}</>}
                            </>
                          ) : (
                            <>
                              Moved to <b className="font-medium text-on-surface">{h.toStage ?? "a deleted stage"}</b>
                              {h.fromStage && <> from {h.fromStage}</>}
                            </>
                          )}
                          <br />
                          {h.actorName ?? "Someone"} · {historyWhen(h.at)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </DrawerBody>

        <DrawerFooter className="flex-wrap justify-between">
          {error ? (
            <p role="alert" className="basis-full text-[13px] text-overdue">
              {error}
            </p>
          ) : null}
          {lead && canDeleteLead ? (
            <Button variant="ghost" onClick={() => onDeleteRequest(lead)} className="text-overdue hover:text-overdue">
              <Trash2 size={14} aria-hidden />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {editable && (
              <Button disabled={!canSave} onClick={save}>
                {saving ? <Spinner size="sm" /> : lead ? "Save changes" : "Add lead"}
              </Button>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
