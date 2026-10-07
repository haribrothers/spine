"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import {
  RECURRING_DUE_OPTIONS,
  RECURRING_FREQUENCY_OPTIONS,
  RECURRING_MODE_OPTIONS,
  RECURRING_NAME_REQUIRED,
  RECURRING_NEEDS_LINE,
  START_IN_PAST,
  ENDS_BEFORE_START,
  recurringDayOptions,
  type RecurringFrequency,
  type RecurringInvoice,
  type RecurringMode,
} from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { ContactPicker } from "../contact-picker";
import { blankLine, computeLinePreview, InvoiceLineEditor, type EditableInvoiceLine } from "../invoice-line-editor";

type Ends = "never" | "on_date" | "after_count";

/** A local calendar date as `YYYY-MM-DD` (never via UTC, which can shift the day). */
function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromIsoDate(value: string): Date {
  return new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
}

function toEditableLines(schedule: RecurringInvoice): EditableInvoiceLine[] {
  return schedule.lines.map((line) => ({
    key: line.id,
    type: line.type,
    catalogItemId: line.catalogItemId,
    name: line.name,
    description: line.description ?? "",
    quantity: line.quantity,
    unitPriceAmount: BigInt(line.unitPriceAmount),
    discountPercentage: line.discountPercentage,
    taxRatePercentage: line.taxRatePercentage,
    taxRateId: line.taxRateId,
    taxGroupId: line.taxGroupId,
    isTaxInclusive: line.isTaxInclusive,
    supplyClass: line.supplyClass,
  }));
}

/** "Monthly maintenance visit × 1 · $1,250.00 + tax" */
function linesSummary(lines: EditableInvoiceLine[], currency: string): string | null {
  const items = lines.filter((l) => l.type === "item" && l.name.trim());
  if (!items.length) return null;
  const subtotal = items.reduce((sum, l) => sum + computeLinePreview(l, currency).subtotal, 0n);
  const taxed = items.some((l) => l.taxRateId || l.taxGroupId || l.taxRatePercentage > 0);
  return `${items.map((l) => `${l.name} × ${l.quantity}`).join(", ")} · ${formatMoney(subtotal, currency)}${taxed ? " + tax" : ""}`;
}

/**
 * US-INV-20 (D-092) — "New recurring invoice" (and editing one, US-INV-22):
 * the schedule, what happens when it runs, and its lines. Saving checks the
 * start date against today; the server checks it again in organisation time.
 */
export function RecurringInvoiceDialog({
  open,
  onOpenChange,
  schedule,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing this schedule; a new one when absent. */
  schedule?: RecurringInvoice | null;
  onSaved: (saved: RecurringInvoice) => void;
}) {
  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [dayRule, setDayRule] = useState("1");
  const [startsOn, setStartsOn] = useState<Date | undefined>(new Date());
  const [ends, setEnds] = useState<Ends>("never");
  const [endsOn, setEndsOn] = useState<Date | undefined>();
  const [maxCount, setMaxCount] = useState("12");
  const [dueDays, setDueDays] = useState(14);
  const [mode, setMode] = useState<RecurringMode>("issue_and_email");
  const [lines, setLines] = useState<EditableInvoiceLine[]>([blankLine()]);
  const [editingLines, setEditingLines] = useState(false);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProblems({});
    setError(null);
    setSaving(false);
    if (schedule) {
      setName(schedule.name);
      setContactId(schedule.contactId);
      setCurrency(schedule.currency);
      setFrequency(schedule.frequency);
      setDayRule(schedule.dayRule);
      setStartsOn(fromIsoDate(schedule.startsOn));
      setEnds(schedule.endsOn ? "on_date" : schedule.maxCount ? "after_count" : "never");
      setEndsOn(schedule.endsOn ? fromIsoDate(schedule.endsOn) : undefined);
      setMaxCount(String(schedule.maxCount ?? 12));
      setDueDays(schedule.dueDays);
      setMode(schedule.mode);
      setLines(toEditableLines(schedule));
      setEditingLines(false);
      return;
    }
    setName("");
    setContactId("");
    setFrequency("monthly");
    setDayRule("1");
    setStartsOn(new Date());
    setEnds("never");
    setEndsOn(undefined);
    setMaxCount("12");
    setDueDays(14);
    setMode("issue_and_email");
    setLines([blankLine()]);
    setEditingLines(true);
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
  }, [open, schedule]);

  const dayOptions = useMemo(() => recurringDayOptions(frequency), [frequency]);
  const summary = linesSummary(lines, currency);

  function changeFrequency(next: RecurringFrequency) {
    setFrequency(next);
    // Weekdays and days of the month don't carry over; start each on the 1st / Monday.
    if ((next === "weekly") !== (frequency === "weekly")) setDayRule("1");
  }

  async function handleSave() {
    setError(null);
    const found: Record<string, string> = {};
    const today = toIsoDate(new Date());
    const starts = startsOn ? toIsoDate(startsOn) : "";
    if (!name.trim()) found.name = RECURRING_NAME_REQUIRED;
    if (!contactId) found.contact = "Pick a customer.";
    if (!starts) found.starts = "Pick a start date.";
    else if (starts < today && starts !== schedule?.startsOn) found.starts = START_IN_PAST;
    if (ends === "on_date" && (!endsOn || toIsoDate(endsOn) < starts)) found.ends = endsOn ? ENDS_BEFORE_START : "Pick an end date.";
    if (ends === "after_count" && !(Number(maxCount) >= 1)) found.ends = "End after at least 1 invoice.";
    if (!lines.some((l) => l.type === "item" && l.name.trim())) found.lines = RECURRING_NEEDS_LINE;
    setProblems(found);
    if (Object.keys(found).length) {
      if (found.lines) setEditingLines(true);
      return;
    }

    const payload = {
      name: name.trim(),
      contactId,
      currency,
      frequency,
      dayRule,
      startsOn: starts,
      endsOn: ends === "on_date" && endsOn ? toIsoDate(endsOn) : null,
      maxCount: ends === "after_count" ? Number(maxCount) : null,
      dueDays,
      mode,
      lines: lines
        .filter((l) => l.name.trim())
        .map((l) => ({
          type: l.type,
          catalogItemId: l.catalogItemId,
          name: l.name,
          description: l.description || null,
          quantity: l.quantity,
          unitPriceAmount: l.unitPriceAmount.toString(),
          discountPercentage: l.discountPercentage,
          taxRatePercentage: l.taxRatePercentage,
          taxRateId: l.taxRateId,
          taxGroupId: l.taxGroupId,
          isTaxInclusive: l.isTaxInclusive,
          supplyClass: l.supplyClass,
        })),
    };
    setSaving(true);
    try {
      const saved = schedule
        ? await apiClient.put<RecurringInvoice>(`/recurring-invoices/${schedule.id}`, payload)
        : await apiClient.post<RecurringInvoice>("/recurring-invoices", payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the schedule. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={editingLines ? "max-w-5xl" : "max-w-2xl"}>
        <DialogHeader>
          <DialogTitle>{schedule ? "Edit recurring invoice" : "New recurring invoice"}</DialogTitle>
          <DialogDescription>
            {schedule
              ? "Changes apply to invoices it creates from now on. Invoices it already created stay as they are."
              : "Spine creates this invoice automatically. You can pause or stop it at any time."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Name" errorText={problems.name}>
              {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly maintenance — Hotel lobby" />}
            </FormField>
            <FormField label="Customer" errorText={problems.contact}>
              {() => <ContactPicker value={contactId} onValueChange={setContactId} />}
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Repeats">
              {(field) => (
                <Select value={frequency} onValueChange={(v) => changeFrequency(v as RecurringFrequency)}>
                  <SelectTrigger {...field}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRING_FREQUENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label="On">
              {(field) => (
                <Select value={dayRule} onValueChange={setDayRule}>
                  <SelectTrigger {...field}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label="Starts" errorText={problems.starts}>
              {() => <DatePicker value={startsOn} onChange={setStartsOn} />}
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <FormField label="Ends" errorText={ends === "never" ? undefined : problems.ends}>
                {(field) => (
                  <Select value={ends} onValueChange={(v) => setEnds(v as Ends)}>
                    <SelectTrigger {...field}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="on_date">On a date</SelectItem>
                      <SelectItem value="after_count">After a number of invoices</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              {ends === "on_date" && <FormField label="End date">{() => <DatePicker value={endsOn} onChange={setEndsOn} />}</FormField>}
              {ends === "after_count" && (
                <FormField label="Number of invoices">
                  {(field) => <Input {...field} type="number" min={1} value={maxCount} onChange={(e) => setMaxCount(e.target.value)} />}
                </FormField>
              )}
            </div>
            <FormField label="Payment due">
              {(field) => (
                <Select value={String(dueDays)} onValueChange={(v) => setDueDays(Number(v))}>
                  <SelectTrigger {...field}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRING_DUE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold text-on-surface">When it runs</legend>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as RecurringMode)} aria-label="When it runs">
              {RECURRING_MODE_OPTIONS.map((o) => (
                <div key={o.value} className="flex items-center gap-2">
                  <RadioGroupItem id={`mode-${o.value}`} value={o.value} />
                  <Label htmlFor={`mode-${o.value}`} className="text-[14px] font-normal text-on-surface">
                    {o.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          {editingLines ? (
            <div className="flex flex-col gap-3 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-on-surface">Lines</h3>
                {summary && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingLines(false)}>
                    Done
                  </Button>
                )}
              </div>
              <InvoiceLineEditor lines={lines} onChange={setLines} currency={currency} />
              {problems.lines && <p className="text-[13px] text-overdue">{problems.lines}</p>}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3">
              <span className="text-[14px] text-on-surface">Lines: {summary}</span>
              <button
                type="button"
                onClick={() => setEditingLines(true)}
                className="shrink-0 rounded-sm text-[14px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Edit lines
              </button>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : "Save schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
