"use client";

import { useEffect, useMemo, useState } from "react";
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
  Combobox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { Trash2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { LEAD_STAGE_LABELS, LEAD_STAGES, type Contact, type Lead, type LeadStage } from "../contacts/types";

// Same list quote-builder.tsx uses for its currency Combobox — kept in sync
// manually since neither module imports from the other.
const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];

interface CurrencyLocaleValue {
  code: string;
  locale: string;
}

/**
 * Create/edit dialog for a lead from the pipeline board (leads-board.tsx).
 * Same Issue-4 "one dialog, editingLead set means edit" pattern as
 * contacts/leads-section.tsx's per-contact dialog, but this one also picks
 * the contact (that dialog is always scoped to one contact already) via
 * Combobox, since the board spans every contact in the org. Currency
 * defaults to the org's configured default (GET /org/settings/currency,
 * same endpoint/shape quote-builder.tsx already uses) rather than a
 * hardcoded "USD", and is a searchable Combobox instead of free text.
 * Source is also a creatable Combobox (allowCreate) rather than plain free
 * text — its options are every distinct `source` value already used across
 * the org's leads (derived from the `leads` prop, not a new endpoint),
 * so a user can pick a value already in use or type a brand-new one; there
 * is no fixed enum for this field anywhere in the schema.
 */
export function LeadDialog({
  open,
  onOpenChange,
  lead,
  contacts,
  leads,
  defaultStage,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = editing; null = creating a new lead. */
  lead: Lead | null;
  contacts: Contact[];
  /** Every lead in the org, used only to suggest previously-used Source values — not re-fetched here since the board already has them loaded. */
  leads: Lead[] | null;
  /** Stage to preselect when creating (e.g. the column the user clicked "Add" from). */
  defaultStage?: LeadStage;
  onSaved: (lead: Lead) => void;
  onDeleted: (leadId: string) => void;
}) {
  const [contactId, setContactId] = useState("");
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<LeadStage>("new");
  const [amount, setAmount] = useState(0n);
  const [currency, setCurrency] = useState("USD");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setContactId(lead.contactId);
      setTitle(lead.title ?? "");
      setStage(lead.stage);
      setAmount(BigInt(lead.valueAmount));
      setCurrency(lead.valueCurrency);
      setSource(lead.source ?? "");
    } else {
      setContactId("");
      setTitle("");
      setStage(defaultStage ?? "new");
      setAmount(0n);
      setSource("");
      // Org default currency, matching quote-builder.tsx's own pre-fill —
      // only for a brand-new lead; editing keeps the lead's stored currency.
      apiClient
        .get<{ key: string; value: CurrencyLocaleValue | null }>("/org/settings/currency")
        .then((res) => {
          if (res.value?.code) setCurrency(res.value.code);
        })
        .catch(() => {});
    }
  }, [open, lead, defaultStage]);

  const currencyOptions = useMemo(() => {
    const codes = COMMON_CURRENCIES.includes(currency) ? COMMON_CURRENCIES : [currency, ...COMMON_CURRENCIES];
    return codes.map((code) => ({ value: code, label: code }));
  }, [currency]);

  const sourceOptions = useMemo(() => {
    const seen = new Set<string>();
    const values: string[] = [];
    for (const l of leads ?? []) {
      if (l.source && !seen.has(l.source)) {
        seen.add(l.source);
        values.push(l.source);
      }
    }
    if (source && !seen.has(source)) values.push(source);
    return values.sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
  }, [leads, source]);

  const contactOptions = contacts.map((c) => ({ value: c.id, label: c.name }));
  const canSave = contactId.length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (lead) {
        const updated = await apiClient.put<Lead>(`/leads/${lead.id}`, {
          contactId,
          title: title || null,
          stage,
          valueAmount: amount.toString(),
          valueCurrency: currency,
          source: source || null,
        });
        onSaved(updated);
      } else {
        const created = await apiClient.post<Lead>("/leads", {
          contactId,
          title: title || undefined,
          stage,
          valueAmount: amount.toString(),
          valueCurrency: currency,
          source: source || undefined,
        });
        onSaved(created);
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!lead) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/leads/${lead.id}`);
      onDeleted(lead.id);
      setConfirmDelete(false);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lead ? "Edit lead" : "Add lead"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <FormField label="Contact">
              {(field) => (
                <Combobox
                  {...field}
                  options={contactOptions}
                  value={contactId}
                  onValueChange={setContactId}
                  placeholder="Select a contact…"
                />
              )}
            </FormField>
            <FormField label="Title">
              {(field) => <Input {...field} value={title} onChange={(e) => setTitle(e.target.value)} />}
            </FormField>
            <FormField label="Stage">
              {(field) => (
                <Select value={stage} onValueChange={(v) => setStage(v as LeadStage)}>
                  <SelectTrigger {...field} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {LEAD_STAGE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <div className="flex gap-3">
              <FormField label="Estimated value" className="flex-1">
                {(field) => <MoneyInput {...field} value={amount} onValueChange={setAmount} currency={currency} />}
              </FormField>
              <FormField label="Currency">
                {(field) => (
                  <Combobox {...field} options={currencyOptions} value={currency} onValueChange={setCurrency} className="w-28" />
                )}
              </FormField>
            </div>
            <FormField label="Source">
              {(field) => (
                <Combobox
                  {...field}
                  options={sourceOptions}
                  value={source}
                  onValueChange={setSource}
                  placeholder="Select or type a source…"
                  allowCreate
                />
              )}
            </FormField>
          </div>
          <DialogFooter className="justify-between">
            {lead ? (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-overdue hover:text-overdue">
                <Trash2 size={14} />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={!canSave} onClick={handleSave}>
                {saving ? <Spinner size="sm" /> : lead ? "Save changes" : "Add lead"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone. The contact itself is not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete}>
              {deleting ? <Spinner size="sm" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
