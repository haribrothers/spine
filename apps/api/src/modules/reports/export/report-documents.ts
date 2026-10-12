import {
  changePercent,
  LEDGER_SOURCE_KINDS,
  periodLabel,
  type CashFlowReport,
  type CreditRegisterReport,
  type DayBookReport,
  type ExpensesByCategoryReport,
  type GeneralLedgerReport,
  type ManualJournal,
  type PaymentRegisterReport,
  type ProfitAndLossComparison,
  type PurchasesByVendorReport,
  type SalesByCustomerReport,
  type SalesByItemReport,
} from "@spine/shared";
import type { BalanceSheetReport, JobProfitabilityReport, PayablesReport, ProfitAndLossReport, ReceivablesReport, ReportAccountLine, TaxSummaryReport, TrialBalanceReport } from "../reports.service";
import { asOfText, heading, matchesSearch, rangeText, type ReportCell, type ReportColumn, type ReportDocument, type ReportRow } from "./report-document";

/**
 * US-RPT-32 — each report as a `ReportDocument`: the same rows, filters
 * and comparison columns the page shows. `currency` is filled in by the
 * exporter from Settings.
 */
type Doc = Omit<ReportDocument, "currency">;

const money = (header: string): ReportColumn => ({ header, kind: "money" });
const text = (header: string): ReportColumn => ({ header, kind: "text" });
const label = (l: { code: string; name: string }) => (l.code ? `${l.code} · ${l.name}` : l.name);
const METHOD_LABELS: Record<string, string> = { cash: "Cash", bank_transfer: "Bank transfer", cheque: "Cheque", card: "Card", upi: "UPI", other: "Other" };

type PlReport = ProfitAndLossReport & { basis?: "accrual" | "cash"; comparison?: ProfitAndLossComparison; openingExcluded?: { cutoverDate: string; invoices: string; bills: string } | null };

export function profitAndLossDocument(report: PlReport): Doc {
  const basis = report.basis === "cash" ? "Cash basis" : "Accrual basis";
  const notes = report.basis === "cash" ? ["Income counts what customers paid in the range and costs what was paid, split across accounts in proportion to each invoice's or bill's lines."] : undefined;
  const c = report.comparison;
  if (!c) {
    const section = (lines: ReportAccountLine[]) => lines.map((l): ReportRow => ({ cells: [label(l), l.amount] }));
    return {
      title: "Profit & Loss",
      subtitle: `${rangeText(report.from, report.to)} · ${basis}`,
      filename: `profit-and-loss-${report.basis === "cash" ? "cash-basis-" : ""}${report.from}-${report.to}`,
      basis,
      columns: [text("Account"), money(report.basis === "cash" ? "Cash basis" : "Amount")],
      rows: [
        heading("Income", 2),
        ...section(report.income),
        { cells: ["Total income", report.totalIncome], style: "total" },
        heading("Expenses", 2),
        ...section(report.expenses),
        { cells: ["Total expenses", report.totalExpenses], style: "total" },
        { cells: [report.basis === "cash" ? "Net profit (cash basis)" : "Net profit", report.netProfit], style: "grand" },
      ],
      notes,
    };
  }
  const monthly = c.mode === "monthly";
  const columns: ReportColumn[] = [text("Account"), ...c.columns.map((col) => money(col.label)), ...(monthly ? [money("Total")] : [money("Change"), { header: "Change %", kind: "percent" as const }])];
  const cells = (amounts: string[], total: string): ReportCell[] => {
    if (monthly) return [...amounts, total];
    const [now, then] = [BigInt(amounts[0] ?? "0"), BigInt(amounts[1] ?? "0")];
    return [now, then, now - then, changePercent(now, then)];
  };
  const lines = (list: ProfitAndLossComparison["income"]) => list.map((l): ReportRow => ({ cells: [label(l), ...cells(l.amounts, l.amounts.reduce((s, a) => s + BigInt(a), 0n).toString())] }));
  return {
    title: "Profit & Loss",
    subtitle: monthly ? `${rangeText(report.from, report.to)} by month · ${basis}` : `${rangeText(report.from, report.to)} compared with ${c.columns[1]!.label} · ${basis}`,
    filename: `profit-and-loss-${report.basis === "cash" ? "cash-basis-" : ""}${c.mode.replace("_", "-")}-${report.from}-${report.to}`,
    basis,
    columns,
    rows: [
      heading("Income", columns.length),
      ...lines(c.income),
      { cells: ["Total income", ...cells(c.totalIncome, report.totalIncome)], style: "total" },
      heading("Expenses", columns.length),
      ...lines(c.expenses),
      { cells: ["Total expenses", ...cells(c.totalExpenses, report.totalExpenses)], style: "total" },
      { cells: ["Net profit", ...cells(c.netProfit, report.netProfit)], style: "grand" },
    ],
    notes,
  };
}

export function balanceSheetDocument(report: BalanceSheetReport & { comparison?: BalanceSheetReport }): Doc {
  const other = report.comparison;
  const sections: [string, ReportAccountLine[], ReportAccountLine[], string, string, string][] = [
    ["Assets", report.assets, other?.assets ?? [], "Total assets", report.totalAssets, other?.totalAssets ?? "0"],
    ["Liabilities", report.liabilities, other?.liabilities ?? [], "Total liabilities", report.totalLiabilities, other?.totalLiabilities ?? "0"],
    ["Equity", report.equity, other?.equity ?? [], "Total equity", report.totalEquity, other?.totalEquity ?? "0"],
  ];
  const width = other ? 4 : 2;
  const rows: ReportRow[] = [];
  for (const [name, lines, then, totalLabel, total, otherTotal] of sections) {
    rows.push(heading(name, width));
    if (!other) {
      rows.push(...lines.map((l): ReportRow => ({ cells: [label(l), l.amount] })), { cells: [totalLabel, total], style: "total" });
      continue;
    }
    const key = (l: ReportAccountLine) => l.accountId ?? `current-${l.code}`;
    const merged = new Map<string, { label: string; code: string; now: bigint; then: bigint }>();
    for (const l of lines) merged.set(key(l), { label: label(l), code: l.code, now: BigInt(l.amount), then: 0n });
    for (const l of then) {
      const m = merged.get(key(l)) ?? { label: label(l), code: l.code, now: 0n, then: 0n };
      m.then = BigInt(l.amount);
      merged.set(key(l), m);
    }
    for (const m of [...merged.values()].sort((a, b) => a.code.localeCompare(b.code))) rows.push({ cells: [m.label, m.now, m.then, m.now - m.then] });
    rows.push({ cells: [totalLabel, total, otherTotal, BigInt(total) - BigInt(otherTotal)], style: "total" });
  }
  rows.push(
    other
      ? { cells: ["Total liabilities + equity", report.totalLiabilitiesAndEquity, other.totalLiabilitiesAndEquity, BigInt(report.totalLiabilitiesAndEquity) - BigInt(other.totalLiabilitiesAndEquity)], style: "grand" }
      : { cells: ["Total liabilities + equity", report.totalLiabilitiesAndEquity], style: "grand" },
  );
  return {
    title: "Balance Sheet",
    subtitle: other ? `${asOfText(report.asOf)} compared with ${periodLabel(other.asOf, other.asOf)}` : asOfText(report.asOf),
    filename: other ? `balance-sheet-${report.asOf}-vs-${other.asOf}` : `balance-sheet-${report.asOf}`,
    basis: "Accrual basis",
    columns: other ? [text("Account"), money(periodLabel(report.asOf, report.asOf)), money(periodLabel(other.asOf, other.asOf)), money("Change")] : [text("Account"), money("Amount")],
    rows,
  };
}

export function trialBalanceDocument(report: TrialBalanceReport): Doc {
  return {
    title: "Trial Balance",
    subtitle: asOfText(report.asOf),
    filename: `trial-balance-${report.asOf}`,
    basis: "Accrual basis",
    columns: [text("Code"), text("Account"), money("Debit"), money("Credit")],
    rows: [...report.lines.map((l): ReportRow => ({ cells: [l.code, l.name, l.debit, l.credit] })), { cells: ["", "Totals", report.totalDebit, report.totalCredit], style: "grand" }],
  };
}

export function cashFlowDocument(report: CashFlowReport): Doc {
  const rows: ReportRow[] = [{ cells: ["Cash at start", report.cashAtStart], style: "total" }];
  for (const s of report.sections) {
    rows.push(heading(s.label, 2), ...s.lines.map((l): ReportRow => ({ cells: [l.label, l.amount] })), { cells: [s.totalLabel, s.total], style: "total" });
  }
  rows.push({ cells: ["Net change", report.netChange], style: "total" }, { cells: ["Cash at end", report.cashAtEnd], style: "grand" });
  return {
    title: "Cash Flow",
    subtitle: rangeText(report.from, report.to),
    filename: `cash-flow-${report.from}-${report.to}`,
    basis: "Accrual basis",
    columns: [text("Line"), money("Amount")],
    rows,
    notes: ["Cash at end equals the total of your bank and cash accounts. Card accounts are liabilities, not cash."],
  };
}

export function taxSummaryDocument(report: TaxSummaryReport): Doc {
  return {
    title: "Tax Summary",
    subtitle: rangeText(report.from, report.to),
    filename: `tax-summary-${report.from}-${report.to}`,
    basis: "Accrual basis",
    columns: [text("Collected by rate"), money("Taxable amount"), money("Tax")],
    rows: [
      ...report.collectedByRate.map((r): ReportRow => ({ cells: [r.name, r.taxableAmount, r.amount] })),
      ...(report.adjustments ? [{ cells: ["Adjustments from credit notes and voided invoices", report.adjustments.taxableAmount, report.adjustments.amount] }] : []),
      { cells: ["Total collected", report.totalTaxable, report.taxCollected], style: "total" },
      // US-RPT-37: the paid side, by tax type and supply class, and what's been paid to the tax authority.
      { cells: ["Paid by rate", null, null], style: "heading" },
      ...report.paidByRate.map((r): ReportRow => ({ cells: [r.name, r.taxableAmount, r.amount] })),
      ...(report.paidAdjustments ? [{ cells: ["Adjustments from voided bills and removed documents", null, report.paidAdjustments.amount] }] : []),
      { cells: ["Tax paid", report.totalPaidTaxable, report.taxPaid], style: "total" },
      { cells: ["Net payable", null, report.netTaxPayable], style: "grand" },
      { cells: ["Paid to the tax authority", null, report.payments.paid] },
      ...(report.payments.refunded !== "0" ? [{ cells: ["Refunded by the tax authority", null, report.payments.refunded] }] : []),
      { cells: ["Still to pay", null, report.payments.stillToPay], style: "total" },
      { cells: ["By tax type", null, null], style: "heading" },
      ...report.byTaxType.rows.flatMap((r): ReportRow[] => [
        { cells: [`${r.label} collected`, null, r.collected] },
        { cells: [`${r.label} paid`, null, r.paid] },
        { cells: [`${r.label} net`, null, r.net], style: "total" },
      ]),
      { cells: ["By supply class", null, null], style: "heading" },
      ...report.bySupplyClass.flatMap((r): ReportRow[] => [
        { cells: [`${r.label} sales`, r.sales, null] },
        { cells: [`${r.label} purchases`, r.purchases, null] },
      ]),
    ],
  };
}

export function jobProfitabilityDocument(report: JobProfitabilityReport, status: string): Doc {
  const pct = (v: number | null) => (v === null ? null : v.toFixed(1));
  return {
    title: "Job profitability",
    subtitle: status === "all" ? "All jobs" : `Jobs: ${status.replace(/_/g, " ").replace("active on hold", "active and on hold")}`,
    filename: `job-profitability-${status.replace(/_/g, "-")}`,
    columns: [text("Job"), text("Status"), money("Contract value"), money("Billed to date"), { header: "Billed %", kind: "percent" }, { header: "Budget used %", kind: "percent" }, money("Revenue"), money("Cost"), money("Margin"), { header: "Margin %", kind: "percent" }],
    rows: report.jobs.map((j) => ({ cells: [j.name, j.status.replace(/_/g, " "), j.contractValueAmount, j.billedToDate, pct(j.billedPct), pct(j.budgetUsedPct), j.revenue, j.cost, j.margin, pct(j.marginPct)] })),
  };
}

export function receivablesDocument(report: ReceivablesReport, search?: string): Doc {
  const rows = report.invoices.filter((i) => matchesSearch(`${i.number ?? ""} ${i.contactName ?? ""}`, search));
  return {
    title: "Receivables",
    subtitle: asOfText(report.asOf),
    filename: `receivables-${report.asOf}`,
    columns: [text("Invoice #"), text("Customer"), text("Due date"), money("Total"), money("Balance due"), { header: "Days overdue", kind: "number" }, text("Bucket")],
    rows: [
      ...rows.map((i): ReportRow => ({ cells: [i.number, i.contactName, i.dueDate, i.totalAmount, i.balanceDue, Math.max(0, i.daysOverdue), i.bucket] })),
      { cells: ["Total", null, null, null, rows.reduce((s, i) => s + BigInt(i.balanceDue), 0n), null, null], style: "grand" },
    ],
  };
}

export function payablesDocument(report: PayablesReport, search?: string): Doc {
  const rows = report.bills.filter((b) => matchesSearch(`${b.billNumber} ${b.contactName ?? ""} ${b.jobName ?? ""}`, search));
  return {
    title: "Payables",
    subtitle: asOfText(report.asOf),
    filename: `payables-${report.asOf}`,
    columns: [text("Bill #"), text("Vendor"), text("Due date"), money("Total"), money("Balance due"), { header: "Days overdue", kind: "number" }, text("Bucket")],
    rows: [
      ...rows.map((b): ReportRow => ({ cells: [b.billNumber, b.contactName, b.dueDate, b.totalAmount, b.balanceDue, Math.max(0, b.daysOverdue), b.bucket] })),
      { cells: ["Total", null, null, null, rows.reduce((s, b) => s + BigInt(b.balanceDue), 0n), null, null], style: "grand" },
    ],
  };
}

export function generalLedgerDocument(report: GeneralLedgerReport): Doc {
  const rows: ReportRow[] = [];
  for (const a of report.accounts) {
    rows.push(heading(`${a.account.code} — ${a.account.name}`, 7));
    rows.push({ cells: [null, "Opening balance", null, null, null, null, a.openingBalance] });
    for (const r of a.rows) rows.push({ cells: [r.date, r.label, [r.contact?.name, r.description].filter(Boolean).join(" · "), r.job ? (r.job.number ?? r.job.name) : null, r.debit, r.credit, r.balance] });
    rows.push({ cells: [null, "Closing balance", null, null, null, null, a.closingBalance], style: "total" });
  }
  return {
    title: "General ledger",
    subtitle: rangeText(report.from, report.to),
    filename: `general-ledger-${report.from}-${report.to}`,
    basis: "Accrual basis",
    columns: [text("Date"), text("Source"), text("Contact · description"), text("Job"), money("Debit"), money("Credit"), money("Balance")],
    rows,
    notes: ["Balances are debit-positive: a negative balance is a credit balance."],
  };
}

export function dayBookDocument(report: DayBookReport, sourceType?: string, search?: string): Doc {
  const entries = report.entries.filter((e) => matchesSearch(`${e.label} ${e.contact?.name ?? ""} ${e.narration ?? ""} ${e.lines.map((l) => `${l.account.code} ${l.account.name}`).join(" ")}`, search));
  const rows: ReportRow[] = entries.flatMap((e) =>
    e.lines.map((l, i): ReportRow => ({ cells: [i === 0 ? e.date : null, i === 0 ? e.label : null, i === 0 ? [e.contact?.name, e.description].filter(Boolean).join(" · ") : null, `${l.account.code} · ${l.account.name}`, l.debit, l.credit] })),
  );
  const sum = (pick: "debit" | "credit") => entries.reduce((s, e) => e.lines.reduce((t, l) => t + BigInt(l[pick]), s), 0n);
  const kind = LEDGER_SOURCE_KINDS.find((k) => k.key === sourceType);
  return {
    title: "Day book",
    subtitle: `${rangeText(report.from, report.to)}${kind ? ` · ${kind.label}` : ""}`,
    filename: `day-book-${report.from}-${report.to}`,
    basis: "Accrual basis",
    columns: [text("Date"), text("Source"), text("Contact · narration"), text("Account"), money("Debit"), money("Credit")],
    rows: [...rows, { cells: [null, null, null, "Totals", sum("debit"), sum("credit")], style: "grand" }],
  };
}

export function journalsDocument(journals: ManualJournal[], filters: { status?: string; from?: string; to?: string; search?: string }): Doc {
  const rows = journals.filter(
    (j) =>
      (!filters.status || filters.status === "all" || j.status === filters.status) &&
      (!filters.from || j.date >= filters.from) &&
      (!filters.to || j.date <= filters.to) &&
      matchesSearch(`${j.number} ${j.reason} ${j.postedBy?.name ?? ""}`, filters.search),
  );
  return {
    title: "Journals",
    subtitle: filters.from || filters.to ? rangeText(filters.from ?? rows.at(-1)?.date ?? filters.to!, filters.to ?? rows[0]?.date ?? filters.from!) : "All journals",
    filename: `journals${filters.from ? `-${filters.from}` : ""}${filters.to ? `-${filters.to}` : ""}`,
    columns: [text("Number"), text("Date"), text("Reason"), text("Status"), money("Total"), text("Posted by")],
    rows: rows.map((j) => ({ cells: [j.number, j.date, j.reason, j.status === "reversed" ? "Reversed" : "Posted", j.total, j.postedBy?.name ?? null] })),
  };
}

export function salesByCustomerDocument(report: SalesByCustomerReport, search?: string): Doc {
  const rows = report.rows.filter((r) => matchesSearch(r.name, search));
  return {
    title: "Sales by customer",
    subtitle: `Net of credit notes · ${rangeText(report.from, report.to)}`,
    filename: `sales-by-customer-${report.from}-${report.to}`,
    columns: [text("Customer"), { header: "Invoices", kind: "number" }, money("Sales before tax"), money("Tax"), money("Total"), { header: "% of sales", kind: "percent" }],
    rows: [
      ...rows.map((r): ReportRow => ({ cells: [r.name, r.invoiceCount, r.salesBeforeTax, r.tax, r.total, r.percentOfSales] })),
      { cells: ["Total", report.totals.invoiceCount, report.totals.salesBeforeTax, report.totals.tax, report.totals.total, "100.0"], style: "grand" },
    ],
  };
}

export function salesByItemDocument(report: SalesByItemReport, search?: string): Doc {
  const rows = report.rows.filter((r) => matchesSearch(r.name, search));
  return {
    title: "Sales by item",
    subtitle: `Quantities from invoice lines, less credit notes · ${rangeText(report.from, report.to)}`,
    filename: `sales-by-item-${report.from}-${report.to}`,
    columns: [text("Item"), { header: "Quantity", kind: "number" }, money("Sales before tax"), money("Average price")],
    rows: [...rows.map((r): ReportRow => ({ cells: [r.name, r.quantity, r.salesBeforeTax, r.averagePrice] })), { cells: ["Total", null, report.totals.salesBeforeTax, null], style: "grand" }],
    notes: ["Item figures read invoice lines and are before any whole-invoice discount."],
  };
}

export function expensesByCategoryDocument(report: ExpensesByCategoryReport, search?: string): Doc {
  const rows = report.rows.filter((r) => matchesSearch(`${r.code} ${r.name}`, search));
  return {
    title: "Expenses by category",
    subtitle: `From bills, expenses, journals and money out · ${rangeText(report.from, report.to)}`,
    filename: `expenses-by-category-${report.from}-${report.to}`,
    columns: [text("Category"), money("Amount"), { header: "% of total", kind: "percent" }],
    rows: [...rows.map((r): ReportRow => ({ cells: [label(r), r.amount, r.percentOfTotal] })), { cells: ["Total", report.total, "100.0"], style: "grand" }],
  };
}

export function purchasesByVendorDocument(report: PurchasesByVendorReport, search?: string): Doc {
  const rows = report.rows.filter((r) => matchesSearch(r.name, search));
  return {
    title: "Purchases by vendor",
    subtitle: `Recorded bills, net of vendor credits · ${rangeText(report.from, report.to)}`,
    filename: `purchases-by-vendor-${report.from}-${report.to}`,
    columns: [text("Vendor"), { header: "Bills", kind: "number" }, money("Before tax"), money("Tax"), money("Total")],
    rows: [
      ...rows.map((r): ReportRow => ({ cells: [r.name, r.billCount, r.amountBeforeTax, r.tax, r.total] })),
      { cells: ["Total", report.totals.billCount, report.totals.amountBeforeTax, report.totals.tax, report.totals.total], style: "grand" },
    ],
  };
}

export function paymentRegisterDocument(report: PaymentRegisterReport, kind: "received" | "made", search?: string, accountName?: string): Doc {
  const rows = report.rows.filter((r) => matchesSearch(`${r.number ?? ""} ${r.contact.name} ${r.allocations.map((a) => a.number).join(" ")}`, search));
  const allocated = (r: PaymentRegisterReport["rows"][number]) =>
    [...r.allocations.map((a) => `${a.number ?? ""}${a.opening ? " (opening)" : ""}`), ...(BigInt(r.heldAsCredit) > 0n ? ["Held as credit"] : []), ...(BigInt(r.refunded) > 0n ? ["Partly refunded"] : [])].join(", ");
  const title = kind === "received" ? "Payments received" : "Payments made";
  return {
    title,
    subtitle: `${rangeText(report.from, report.to)}${accountName ? ` · ${accountName}` : ""}`,
    filename: `payments-${kind}-${report.from}-${report.to}`,
    columns: [text("Number"), text("Date"), text(kind === "received" ? "Customer" : "Vendor"), text("Method"), text("Account"), money("Amount"), text("Allocated to")],
    rows: [
      ...rows.map((r): ReportRow => ({ cells: [r.number, r.date, r.contact.name, METHOD_LABELS[r.method] ?? r.method, r.moneyAccount?.name ?? null, r.amount, allocated(r)] })),
      { cells: ["Total", null, null, null, null, rows.reduce((s, r) => s + BigInt(r.amount), 0n), null], style: "grand" },
    ],
  };
}

export function creditRegisterDocument(report: CreditRegisterReport, kind: "customer" | "vendor", search?: string): Doc {
  const rows = report.rows.filter((r) => matchesSearch(`${r.number ?? ""} ${r.reference ?? ""} ${r.contact.name} ${r.against?.number ?? ""}`, search));
  const sum = (pick: "total" | "applied" | "refunded" | "held") => rows.reduce((s, r) => s + BigInt(r[pick]), 0n);
  return {
    title: kind === "customer" ? "Credit notes and refunds" : "Vendor credits",
    subtitle: rangeText(report.from, report.to),
    filename: `${kind === "customer" ? "credit-notes-and-refunds" : "vendor-credits"}-${report.from}-${report.to}`,
    columns: [text("Number"), ...(kind === "vendor" ? [text("Vendor reference")] : []), text("Date"), text(kind === "customer" ? "Customer" : "Vendor"), text(kind === "customer" ? "Invoice" : "Bill"), money("Amount"), money("Applied"), money("Refunded"), money("Still held")],
    rows: [
      ...rows.map((r): ReportRow => ({ cells: [r.number, ...(kind === "vendor" ? [r.reference] : []), r.date, r.contact.name, r.against?.number ?? null, r.total, r.applied, r.refunded, r.held] })),
      { cells: ["Total", ...(kind === "vendor" ? [null] : []), null, null, null, sum("total"), sum("applied"), sum("refunded"), sum("held")], style: "grand" },
    ],
  };
}
