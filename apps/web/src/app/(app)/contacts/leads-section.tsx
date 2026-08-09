"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
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
import { Pencil } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { LEAD_STAGE_LABELS, LEAD_STAGES, type Lead, type LeadStage } from "./types";

/**
 * S-01.4 — "create a lead with an estimated value and stage." This is the
 * per-contact flat list; the org-wide kanban board (S-01.5) lives at
 * /leads (see leads/leads-board.tsx). Stage uses Badge, not StatusChip:
 * StatusChip is reserved for financial *document* status
 * (paid/due-soon/overdue/draft), and a lead stage isn't that. "Add"/"Edit"
 * share the same Dialog (Issue 4 pattern) — `editingId` set means editing
 * via `PUT /leads/:id`, null means creating via `POST /leads`.
 */
export function LeadsSection({
  contactId,
  leads,
  onChanged,
  onCreated,
}: {
  contactId: string;
  leads: Lead[] | null;
  onChanged: () => void;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<LeadStage>("new");
  const [amount, setAmount] = useState(0n);
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);

  function openAddDialog() {
    setEditingId(null);
    setTitle("");
    setStage("new");
    setAmount(0n);
    setCurrency("USD");
    setOpen(true);
  }

  function openEditDialog(lead: Lead) {
    setEditingId(lead.id);
    setTitle(lead.title ?? "");
    setStage(lead.stage);
    setAmount(BigInt(lead.valueAmount));
    setCurrency(lead.valueCurrency);
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.put(`/leads/${editingId}`, {
          title: title || null,
          stage,
          valueAmount: amount.toString(),
          valueCurrency: currency,
        });
      } else {
        await apiClient.post("/leads", {
          contactId,
          title: title || undefined,
          stage,
          valueAmount: amount.toString(),
          valueCurrency: currency,
        });
      }
      setOpen(false);
      onChanged();
      if (!editingId) onCreated?.();
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
              <div className="flex items-center gap-3">
                <Badge>{LEAD_STAGE_LABELS[lead.stage]}</Badge>
                <button
                  type="button"
                  aria-label={`Edit ${lead.title ?? "lead"}`}
                  onClick={() => openEditDialog(lead)}
                  className="text-on-surface-muted transition-colors hover:text-on-surface"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-on-surface-muted">No leads yet.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <Button size="sm" variant="secondary" className="self-start" onClick={openAddDialog}>
          Add lead
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit lead" : "Add lead"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
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
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? <Spinner size="sm" /> : editingId ? "Save changes" : "Add lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
