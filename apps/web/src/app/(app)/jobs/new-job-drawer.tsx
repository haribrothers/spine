"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Button,
  Combobox,
  DatePicker,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  FormField,
  Input,
  Spinner,
  Textarea,
} from "@spine/ui";
import { FileCheck, X } from "lucide-react";
import { JOB_END_BEFORE_START, fromDecimalString } from "@spine/shared";
import { ApiError, apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { ContactPicker } from "../quotes/contact-picker";
import type { Quote } from "../quotes/types";
import type { Address } from "../contacts/types";
import { useToast } from "../../../components/toast-host";

import { SectionLink } from "../../../components/section-link";
const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD", "NZD", "ZAR"];

/** The 409 the quote-conversion guard sends in "warn" mode (US-QUO-16): what's already been made from the quote. */
interface ConversionGuardBody {
  message: string;
  existing: { jobs: { id: string; name: string; number?: string | null }[]; invoices: { id: string; number: string | null }[] };
}

function isConversionGuardConflict(err: unknown): err is ApiError & { body: ConversionGuardBody } {
  return err instanceof ApiError && err.status === 409 && typeof err.body === "object" && err.body !== null && "existing" in err.body;
}

/** US-JOB-30 — the contact's site address (primary first), else its billing address, as one line. */
export function defaultSiteAddress(addresses: Address[]): string {
  const pick = (type: Address["type"]) => addresses.filter((a) => a.type === type).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))[0];
  const address = pick("site") ?? pick("billing");
  if (!address) return "";
  const place = [address.city, [address.state, address.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [address.line1, address.line2, place].filter(Boolean).join(", ");
}

/**
 * US-JOB-30 (D-215) — start a job from the Jobs list: contact and name,
 * the site address filled from the contact's, currency, contract value,
 * retention, dates and notes. "Start from an accepted quote" converts one
 * instead, exactly as from the quote's page, with the repeat-conversion
 * warning when the business has it on. Saving opens the job on Milestones.
 */
export function NewJobDrawer({
  open,
  onOpenChange,
  defaultCurrency,
  convertedQuoteIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency: string;
  /** Quotes that already have a job, left out of "Start from an accepted quote". */
  convertedQuoteIds: Set<string>;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [mode, setMode] = useState<"blank" | "quote">("blank");
  const [contactId, setContactId] = useState("");
  const [name, setName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [siteFrom, setSiteFrom] = useState<string | null>(null);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [contractValue, setContractValue] = useState("");
  const [retention, setRetention] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [quoteId, setQuoteId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConversionGuardBody | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("blank");
    setContactId("");
    setName("");
    setSiteAddress("");
    setSiteFrom(null);
    setCurrency(defaultCurrency);
    setContractValue("");
    setRetention("");
    setStartDate(undefined);
    setEndDate(undefined);
    setNotes("");
    setQuoteId("");
    setErrors({});
    setError(null);
    setConflict(null);
  }, [open, defaultCurrency]);

  useEffect(() => {
    if (!open || mode !== "quote" || quotes) return;
    apiClient
      .get<Quote[]>("/quotes")
      .then(setQuotes)
      .catch(() => setQuotes([]));
  }, [open, mode, quotes]);

  const acceptedQuotes = useMemo(() => (quotes ?? []).filter((q) => q.status === "accepted" && !q.isSuperseded && !convertedQuoteIds.has(q.id)), [quotes, convertedQuoteIds]);
  const quoteOptions = useMemo(
    () => acceptedQuotes.map((q) => ({ value: q.id, label: `${q.number ?? "Quote"} · ${q.title ?? q.contactName ?? ""} · ${formatMoney(BigInt(q.totalAmount), q.currency)}` })),
    [acceptedQuotes],
  );
  const chosenQuote = acceptedQuotes.find((q) => q.id === quoteId);
  const currencyOptions = useMemo(() => (COMMON_CURRENCIES.includes(currency) ? COMMON_CURRENCIES : [currency, ...COMMON_CURRENCIES]).map((code) => ({ value: code, label: code })), [currency]);

  async function chooseContact(id: string) {
    setContactId(id);
    setErrors((e) => ({ ...e, contactId: "" }));
    try {
      const contact = await apiClient.get<{ name: string; addresses?: Address[] }>(`/contacts/${id}?picker=1`);
      const address = defaultSiteAddress(contact.addresses ?? []);
      // Only fill an address the person hasn't typed themselves.
      if (address && (!siteAddress || siteFrom !== null)) {
        setSiteAddress(address);
        setSiteFrom(contact.name);
      }
    } catch {
      // No address to suggest; the field stays as it is.
    }
  }

  function retentionNumber(): number | null {
    if (!retention.trim()) return 0;
    const n = Number(retention);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
  }

  async function createFromQuote(confirm = false) {
    const retentionPct = retentionNumber();
    if (!quoteId) return setErrors({ quoteId: "Choose an accepted quote." });
    if (retentionPct === null) return setErrors({ retention: "Enter a percentage from 0 to 100." });
    setSaving(true);
    setError(null);
    try {
      const job = await apiClient.post<{ id: string; number: string | null }>(`/jobs/from-quote/${quoteId}`, { retentionPct, confirm });
      opened(job);
    } catch (err) {
      if (isConversionGuardConflict(err)) setConflict(err.body);
      else setError(err instanceof Error ? err.message : "Couldn't create the job. Try again.");
      setSaving(false);
    }
  }

  async function create() {
    const next: Record<string, string> = {};
    if (!contactId) next.contactId = "Choose who the job is for.";
    if (!name.trim()) next.name = "Give the job a name.";
    const amount = contractValue.trim() ? fromDecimalString(contractValue.replace(/,/g, "").trim(), currency) : 0n;
    if (amount === null || amount < 0n) next.contractValue = "Enter a contract value of zero or more.";
    const retentionPct = retentionNumber();
    if (retentionPct === null) next.retention = "Enter a percentage from 0 to 100.";
    if (startDate && endDate && endDate < startDate) next.endDate = JOB_END_BEFORE_START;
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    setError(null);
    try {
      const job = await apiClient.post<{ id: string; number: string | null }>("/jobs", {
        contactId,
        name: name.trim(),
        siteAddress: siteAddress.trim() || null,
        currency,
        contractValueAmount: (amount ?? 0n).toString(),
        retentionPct,
        startDate: startDate ? toDay(startDate) : null,
        endDate: endDate ? toDay(endDate) : null,
        notes: notes.trim() || null,
      });
      opened(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the job. Try again.");
      setSaving(false);
    }
  }

  /** Opens the new job on Milestones; its toast shows there (D-223). */
  function opened(job: { id: string; number: string | null }) {
    onOpenChange(false);
    setSaving(false);
    showToast(job.number ? `Job ${job.number} created` : "Job created", "Add its milestones to bill it as the work is done.");
    router.push(`/jobs/${job.id}?tab=milestones`);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent data-testid="new-job-drawer">
        <DrawerHeader>
          <DrawerTitle>New job</DrawerTitle>
          <DrawerDescription>Track work, billing and costs for a customer. You can start from an accepted quote or fill it in yourself.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {mode === "blank" ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface-sunken px-3.5 py-3">
              <FileCheck size={18} className="shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1 text-[12.5px] text-on-surface-muted">
                <p className="text-[13px] font-semibold text-on-surface">Start from an accepted quote</p>
                Fills in the contact, name and contract value, and links the quote.
              </div>
              <Button variant="secondary" size="sm" onClick={() => setMode("quote")}>
                Choose a quote
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-sunken px-3.5 py-3" data-testid="new-job-from-quote">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-on-surface">Start from an accepted quote</p>
                <Button variant="ghost" size="sm" onClick={() => setMode("blank")}>
                  <X size={14} aria-hidden />
                  Fill it in myself
                </Button>
              </div>
              {quotes === null ? (
                <Spinner size="sm" />
              ) : acceptedQuotes.length === 0 ? (
                <p className="text-[13px] text-on-surface-muted">No accepted quotes are waiting for a job. Fill the job in yourself, or accept a quote first.</p>
              ) : (
                <FormField label="Accepted quote" required errorText={errors.quoteId || undefined}>
                  {(field) => <Combobox {...field} options={quoteOptions} value={quoteId || undefined} onValueChange={(v) => { setQuoteId(v); setConflict(null); }} placeholder="Choose a quote…" />}
                </FormField>
              )}
              {chosenQuote && (
                <p className="text-[12.5px] text-on-surface-muted">
                  For {chosenQuote.contactName ?? "the customer"} · contract value {formatMoney(BigInt(chosenQuote.totalAmount), chosenQuote.currency)}. The job is named after the quote&apos;s first item.
                </p>
              )}
              <FormField label="Retention %" helperText="Held back from each progress invoice until you release it." errorText={errors.retention || undefined}>
                {(field) => <Input {...field} inputMode="decimal" value={retention} onChange={(e) => setRetention(e.target.value)} placeholder="0" className="w-28" />}
              </FormField>
              {conflict && (
                <Alert variant="warning" data-testid="new-job-conflict">
                  <AlertDescription className="flex flex-col gap-1.5">
                    <span className="font-medium">This quote has already been converted before.</span>
                    <span>Converting again creates a separate job; the amount isn&apos;t split between them.</span>
                    <span className="flex flex-wrap gap-x-3">
                      {conflict.existing.jobs.map((j) => (
                        <Link key={j.id} href={`/jobs/${j.id}`} className="text-primary hover:underline">
                          {j.number ? `${j.number} · ${j.name}` : j.name}
                        </Link>
                      ))}
                      {conflict.existing.invoices.map((i) => (
                        <SectionLink key={i.id} href={`/invoices/${i.id}`} className="text-primary hover:underline">
                          {i.number ?? "Draft invoice"}
                        </SectionLink>
                      ))}
                    </span>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {mode === "blank" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Contact" required className="sm:col-span-2" errorText={errors.contactId || undefined}>
                {(field) => <ContactPicker {...field} value={contactId} onValueChange={(id) => void chooseContact(id)} />}
              </FormField>
              <FormField label="Job name" required className="sm:col-span-2" errorText={errors.name || undefined}>
                {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bathroom refit — 2nd floor" />}
              </FormField>
              <FormField
                label="Site address"
                className="sm:col-span-2"
                helperText={siteFrom ? `From ${siteFrom}'s address — change it if the work is elsewhere.` : "Where the work happens."}
              >
                {(field) => (
                  <Input
                    {...field}
                    value={siteAddress}
                    onChange={(e) => {
                      setSiteAddress(e.target.value);
                      setSiteFrom(null);
                    }}
                  />
                )}
              </FormField>
              <FormField label="Currency" required>
                {() => <Combobox options={currencyOptions} value={currency} onValueChange={setCurrency} aria-label="Currency" />}
              </FormField>
              <FormField label="Contract value" errorText={errors.contractValue || undefined}>
                {(field) => <Input {...field} inputMode="decimal" className="text-right tabular-nums" value={contractValue} onChange={(e) => setContractValue(e.target.value)} placeholder="0.00" />}
              </FormField>
              <FormField label="Retention %" helperText="Held back from each progress invoice." errorText={errors.retention || undefined}>
                {(field) => <Input {...field} inputMode="decimal" value={retention} onChange={(e) => setRetention(e.target.value)} placeholder="0" />}
              </FormField>
              <div className="hidden sm:block" />
              <FormField label="Start date">{() => <DatePicker value={startDate} onChange={setStartDate} aria-label="Start date" />}</FormField>
              <FormField label="End date" errorText={errors.endDate || undefined}>
                {() => <DatePicker value={endDate} onChange={setEndDate} aria-label="End date" />}
              </FormField>
              <FormField label="Notes" className="sm:col-span-2">
                {(field) => <Textarea {...field} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
              </FormField>
            </div>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {mode === "quote" ? (
            <Button onClick={() => void createFromQuote(conflict !== null)} disabled={saving || !quoteId}>
              {saving ? <Spinner size="sm" /> : conflict ? "Create another job" : "Create job"}
            </Button>
          ) : (
            <Button onClick={() => void create()} disabled={saving}>
              {saving ? <Spinner size="sm" /> : "Create job"}
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** A picked day as "2026-10-20", without shifting it across time zones. */
function toDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
