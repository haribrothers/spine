"use client";

import { useModule } from "../../../lib/modules-context";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
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
import type { AiBankSuggestion, MoneyAccount, StatementLine } from "@spine/shared";
import { Sparkles } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { useMyRole } from "../../../lib/role-context";
import { formatMoney } from "../../../lib/money";
import type { StatementPrefill } from "../../../components/statement-prefill";
import { RecordPaymentDialog } from "../../../components/record-payment-dialog";
import { AiSuggestedTag } from "../../../components/ai-suggested-tag";
import { aiCreateLabel } from "./reconcile-state";
import { RecordVendorPaymentDialog } from "../vendor-payments/record-vendor-payment-dialog";
import { TaxPaymentDialog } from "../reports/tax-payment-dialog";
import type { ExpenseCategory, JobOption } from "../expenses/types";
import { MoneyInOutDialog } from "./money-in-out-dialog";
import { TransferDialog } from "./transfer-dialog";
import { formatDay } from "./dates";

type Kind = "payment" | "transfer" | "money" | "vendor_payment" | "expense" | "tax_payment";

const NO_JOB = "__none__";

/** The quarter before the line's date, as a tax period. */
function previousQuarter(date: string): { from: string; to: string } {
  const d = new Date(`${date}T00:00:00`);
  const q = Math.floor(d.getMonth() / 3);
  const start = new Date(d.getFullYear(), q * 3 - 3, 1);
  const end = new Date(d.getFullYear(), q * 3, 0);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { from: iso(start), to: iso(end) };
}

/**
 * US-BANK-09 — `ReconcileCreateDrawer`: record what a statement line shows
 * but Spine doesn't have, then match the line to it. Money in can be a
 * customer payment, a transfer or other money in; money out a vendor
 * payment, an expense, a transfer, other money out or a tax payment. Only
 * the options this person may record are offered. Each opens its normal
 * form with the line's amount, date and account fixed.
 */
export function ReconcileCreateDrawer({
  line,
  onOpenChange,
  account,
  accounts,
  currency,
  onCreated,
  aiCreate,
}: {
  /** US-AI-14 — what AI suggested creating for the line: the kind is chosen and its form prefilled, all changeable. */
  aiCreate?: AiBankSuggestion["create"];
  line: StatementLine | null;
  onOpenChange: (open: boolean) => void;
  account: { id: string; name: string };
  accounts: MoneyAccount[];
  currency: string;
  /** The new document's id; the reconcile page matches the line to its entry. */
  onCreated: (line: StatementLine, sourceId: string) => void;
}) {
  const role = useMyRole();
  const canPayment = useCapability("payments.edit_own");
  const canVendorPayment = useCapability("vendor_payments.edit_own");
  const canRecordBanking = useCapability("banking.record");
  const canCreateExpense = useCapability("expenses.edit_own");
  const canApproveExpense = useCapability("expenses.approve");
  const isOwner = role === "owner";

  const amount = line ? BigInt(line.amount) : 0n;
  const isIn = amount > 0n;
  const active = useMemo(() => accounts.filter((a) => !a.archivedAt), [accounts]);
  const others = active.filter((a) => a.id !== account.id);
  const options = useMemo(() => {
    const list: { kind: Kind; label: string; allowed: boolean }[] = isIn
      ? [
          { kind: "payment", label: "Customer payment", allowed: canPayment },
          { kind: "transfer", label: "Transfer from another account", allowed: canRecordBanking && others.length > 0 },
          { kind: "money", label: "Other money in", allowed: canRecordBanking },
        ]
      : [
          { kind: "vendor_payment", label: "Vendor payment", allowed: canVendorPayment },
          // Staff can't approve their own expense (US-PUR-20), and an expense posts only once approved.
          { kind: "expense", label: "Expense", allowed: canCreateExpense && canApproveExpense && isOwner },
          { kind: "transfer", label: "Transfer to another account", allowed: canRecordBanking && others.length > 0 },
          { kind: "money", label: "Other money out", allowed: canRecordBanking },
          { kind: "tax_payment", label: "Tax payment", allowed: isOwner },
        ];
    return list.filter((o) => o.allowed);
  }, [isIn, canPayment, canRecordBanking, canVendorPayment, canCreateExpense, canApproveExpense, isOwner, others.length]);

  const jobsOn = useModule("jobsField");
  const [kind, setKind] = useState<Kind | null>(null);
  const [openForm, setOpenForm] = useState<Kind | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [jobId, setJobId] = useState(NO_JOB);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!line) return;
    setKind(aiCreate && options.some((o) => o.kind === aiCreate.kind) ? aiCreate.kind : (options[0]?.kind ?? null));
    setOpenForm(null);
    setCategoryId("");
    setJobId(NO_JOB);
    setDescription(line.description);
    setError(null);
    // Only depends on the line: the options are fixed while it's open.
  }, [line]);

  useEffect(() => {
    if (kind !== "expense" || categories.length) return;
    apiClient.get<ExpenseCategory[]>("/expense-categories").then(setCategories).catch(() => {});
    apiClient.get<JobOption[]>("/jobs?picker=1").then(setJobs).catch(() => {});
  }, [kind, categories.length]);

  const prefill: StatementPrefill | undefined = useMemo(
    () =>
      line
        ? {
            amount: amount < 0n ? -amount : amount,
            date: line.date,
            moneyAccountId: account.id,
            moneyAccountName: account.name,
            reference: line.reference ?? line.description.slice(0, 120),
            description: line.description,
            ...(aiCreate && kind === aiCreate.kind ? { ai: { categoryAccountId: aiCreate.accountId, contactId: aiCreate.contactId } } : {}),
          }
        : undefined,
    [line, amount, account.id, account.name, aiCreate, kind],
  );
  const transferPrefill = useMemo(() => (prefill ? { ...prefill, direction: (isIn ? "in" : "out") as "in" | "out" } : undefined), [prefill, isIn]);

  function created(sourceId: string) {
    if (!line) return;
    setOpenForm(null);
    onOpenChange(false);
    onCreated(line, sourceId);
  }

  async function saveExpense() {
    if (!line || !prefill) return;
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const expense = await apiClient.post<{ id: string; status: string }>("/expenses", {
        categoryId,
        jobId: jobId === NO_JOB ? null : jobId,
        date: line.date,
        currency,
        amount: prefill.amount.toString(),
        description: description.trim() || null,
        paidBy: "company",
        moneyAccountId: account.id,
      });
      // With Approvals off it's approved on save; otherwise approve it now so it posts.
      if (expense.status === "submitted") await apiClient.post(`/expenses/${expense.id}/approve`, { comment: null, moneyAccountId: account.id });
      created(expense.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record this expense. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const signed = line ? `${amount > 0n ? "+" : ""}${formatMoney(amount, currency)}` : "";

  return (
    <>
      <Drawer open={line !== null && openForm === null} onOpenChange={onOpenChange}>
        <DrawerContent size="lg">
          <DrawerHeader>
            <DrawerTitle>Create from statement line</DrawerTitle>
            <DrawerDescription>{line ? `${formatDay(line.date)} · ${line.description} · ${signed}. Saving matches the line to the new entry.` : ""}</DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="flex flex-col gap-5">
            {error && (
              <Alert variant="critical">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {aiCreate && (
              <p className="flex items-start gap-2 rounded-md bg-info-bg px-3 py-2 text-[13px] text-on-surface" data-testid="ai-create-reason">
                <Sparkles size={15} aria-hidden className="mt-0.5 shrink-0 text-primary" />
                <span>
                  <strong className="font-semibold">AI suggests creating: {aiCreateLabel(aiCreate)}</strong> — {aiCreate.reason}. Check it before you save.
                </span>
              </p>
            )}
            {options.length === 0 ? (
              <p className="text-[14px] text-on-surface-muted">You can&apos;t record any of these entries. Ask an owner, or exclude the line.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[14px] font-medium text-on-surface" id="record-it-as">
                  Record it as
                </p>
                <RadioGroup value={kind ?? undefined} onValueChange={(v) => setKind(v as Kind)} aria-labelledby="record-it-as" className="flex flex-col gap-2">
                  {options.map((o) => (
                    <div key={o.kind} className="flex items-center gap-2">
                      <RadioGroupItem value={o.kind} id={`create-${o.kind}`} />
                      <Label htmlFor={`create-${o.kind}`}>{o.label}</Label>
                      {aiCreate?.kind === o.kind && <AiSuggestedTag />}
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
            {kind === "expense" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="Amount" required>
                  {(field) => <Input {...field} value={prefill ? formatMoney(prefill.amount, currency) : ""} disabled className="text-right tabular-nums" />}
                </FormField>
                <FormField label="Date" required>
                  {(field) => <Input {...field} value={line ? formatDay(line.date) : ""} disabled />}
                </FormField>
                <FormField label="Category" required>
                  {(field) => (
                    <Select value={categoryId || undefined} onValueChange={setCategoryId}>
                      <SelectTrigger id={field.id}>
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                {/* US-SET-24: no jobs while Jobs & field is switched off. */}
                {jobsOn && (
                  <FormField label="Job" helperText="Optional — counts as job cost.">
                    {(field) => (
                      <Select value={jobId} onValueChange={setJobId}>
                        <SelectTrigger id={field.id} aria-describedby={field["aria-describedby"]}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_JOB}>No job</SelectItem>
                          {jobs.map((j) => (
                            <SelectItem key={j.id} value={j.id}>
                              {j.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                )}
                <FormField label="Paid from" required>
                  {() => <p className="py-2 text-[14px] text-on-surface">{account.name}</p>}
                </FormField>
                <FormField label="Description">
                  {(field) => <Input {...field} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />}
                </FormField>
              </div>
            )}
          </DrawerBody>
          <DrawerFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            {kind === "expense" ? (
              <Button onClick={saveExpense} disabled={saving}>
                {saving ? <Spinner size="sm" /> : "Save and match"}
              </Button>
            ) : (
              kind && <Button onClick={() => setOpenForm(kind)}>Continue</Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <RecordPaymentDialog open={openForm === "payment"} onOpenChange={(o) => !o && setOpenForm(null)} prefill={prefill} onRecorded={(p) => created(p.id)} />
      <RecordVendorPaymentDialog open={openForm === "vendor_payment"} onOpenChange={(o) => !o && setOpenForm(null)} prefill={prefill} onRecorded={(p) => created(p.id)} />
      <TransferDialog open={openForm === "transfer"} onOpenChange={(o) => !o && setOpenForm(null)} accounts={active} currency={currency} prefill={transferPrefill} onRecorded={(t) => created(t.id)} />
      <MoneyInOutDialog
        direction={isIn ? "in" : "out"}
        open={openForm === "money"}
        onOpenChange={(o) => !o && setOpenForm(null)}
        accounts={active}
        currency={currency}
        prefill={prefill}
        onRecorded={(e) => created(e.id)}
      />
      {line && (
        <TaxPaymentDialog
          open={openForm === "tax_payment"}
          onOpenChange={(o) => !o && setOpenForm(null)}
          reportFrom={previousQuarter(line.date).from}
          reportTo={previousQuarter(line.date).to}
          currency={currency}
          prefill={prefill}
          onRecorded={(t) => created(t.id)}
        />
      )}
    </>
  );
}
