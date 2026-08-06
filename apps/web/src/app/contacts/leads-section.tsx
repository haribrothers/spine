"use client";

import { useState } from "react";
import { Badge, Button, FormField, Input, MoneyInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Spinner } from "@spine/ui";
import { apiClient } from "../../lib/api-client";
import { LEAD_STAGE_LABELS, LEAD_STAGES, type Lead, type LeadStage } from "./types";

/**
 * S-01.4 — "create a lead with an estimated value and stage." S-01.5's
 * pipeline board (kanban by stage) is explicitly deferred per this task's
 * scope — this is a flat list, filterable being the board's cheaper
 * substitute for now. Stage uses Badge, not StatusChip: StatusChip is
 * reserved for financial *document* status (paid/due-soon/overdue/draft),
 * and a lead stage isn't that.
 */
export function LeadsSection({ contactId, leads, onChanged }: { contactId: string; leads: Lead[] | null; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<LeadStage>("new");
  const [amount, setAmount] = useState(0n);
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    setSaving(true);
    try {
      await apiClient.post("/leads", {
        contactId,
        title: title || undefined,
        stage,
        valueAmount: amount.toString(),
        valueCurrency: currency,
      });
      setTitle("");
      setStage("new");
      setAmount(0n);
      setAdding(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[14px] font-semibold text-on-surface">Leads</h3>
      {leads === null ? (
        <Spinner size="sm" />
      ) : leads.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {leads.map((lead) => (
            <li key={lead.id} className="flex items-center justify-between rounded-md border border-border-strong px-3 py-2 text-[13px]">
              <div>
                <span className="font-medium text-on-surface">{lead.title ?? "Untitled lead"}</span>
                <span className="text-on-surface-muted">
                  {" "}
                  · {(Number(lead.valueAmount) / 100).toLocaleString(undefined, { style: "currency", currency: lead.valueCurrency })}
                </span>
              </div>
              <Badge>{LEAD_STAGE_LABELS[lead.stage]}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-on-surface-muted">No leads yet.</p>
      )}

      {adding ? (
        <div className="flex flex-col gap-2 rounded-md border border-border-strong p-3">
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
          <FormField label="Estimated value">
            {(field) => <MoneyInput {...field} value={amount} onValueChange={setAmount} currency={currency} />}
          </FormField>
          <FormField label="Currency">
            {(field) => <Input {...field} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="w-24" />}
          </FormField>
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={handleAdd}>
              {saving ? <Spinner size="sm" /> : "Add lead"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="self-start" onClick={() => setAdding(true)}>
          Add lead
        </Button>
      )}
    </section>
  );
}
