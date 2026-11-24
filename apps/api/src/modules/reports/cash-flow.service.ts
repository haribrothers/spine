import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import type { CashFlowAccount, CashFlowLine, CashFlowReport, CashFlowSection, CashFlowSectionKey } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts, journalEntries, journalLines, moneyAccounts } from "../../db/schema";

type Account = { id: string; code: string; name: string; type: string };
type Placement = { section: "cash" | "profit" | CashFlowSectionKey; line: string };

/** Operating lines after net profit, in the order the statement shows them. */
const OPERATING_LINES: { key: string; label: (amount: bigint) => string }[] = [
  { key: "receivables", label: (a) => (a < 0n ? "Increase in receivables and retention" : "Decrease in receivables and retention") },
  { key: "payables", label: (a) => (a < 0n ? "Decrease in payables" : "Increase in payables") },
  { key: "tax", label: () => "Tax collected less paid" },
  { key: "advances", label: (a) => (a < 0n ? "Customer advances used" : "Customer advances received") },
  { key: "cards", label: (a) => (a < 0n ? "Card balances paid down" : "Increase in card balances") },
  { key: "other", label: () => "Other operating changes" },
];

/**
 * Where an account sits on the statement (glossary, "Cash flow sections"):
 * bank and cash money accounts are the cash; income and expense make net
 * profit; cards and working capital are Operating; fixed assets
 * (1500–1999) Investing; equity and loans (2500–2999) Financing.
 */
export function placeAccount(account: Account, kind: "bank" | "cash" | "card" | null): Placement {
  if (kind === "bank" || kind === "cash") return { section: "cash", line: "cash" };
  if (kind === "card") return { section: "operating", line: "cards" };
  if (account.type === "income" || account.type === "expense") return { section: "profit", line: "net_profit" };
  if (account.type === "equity") return { section: "financing", line: account.id };
  const code = Number(account.code);
  if (account.type === "asset") {
    if (code >= 1500 && code <= 1999) return { section: "investing", line: account.id };
    if (code >= 1100 && code <= 1199) return { section: "operating", line: "receivables" };
    if (code >= 1200 && code <= 1299) return { section: "operating", line: "tax" };
    return { section: "operating", line: "other" };
  }
  if (code >= 2500 && code <= 2999) return { section: "financing", line: account.id };
  if (code >= 2000 && code <= 2099) return { section: "operating", line: "payables" };
  if (code >= 2100 && code <= 2199) return { section: "operating", line: "tax" };
  if (code >= 2200 && code <= 2299) return { section: "operating", line: "advances" };
  return { section: "operating", line: "other" };
}

/** US-RPT-26 — the cash flow statement for a range, indirect method, from `journal_lines`. */
@Injectable()
export class CashFlowService {
  private readonly logger = new Logger(CashFlowService.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async report(orgId: string, from: string, to: string): Promise<CashFlowReport> {
    const chart = await this.db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type, kind: moneyAccounts.kind })
      .from(accounts)
      .leftJoin(moneyAccounts, eq(moneyAccounts.accountId, accounts.id))
      .where(eq(accounts.orgId, orgId))
      .orderBy(accounts.code);
    const net = (where: ReturnType<typeof and>) =>
      this.db
        .select({ accountId: journalLines.accountId, net: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)` })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
        .where(and(eq(journalEntries.orgId, orgId), where))
        .groupBy(journalLines.accountId);
    const [movedRows, beforeRows, throughRows] = await Promise.all([
      net(and(gte(journalEntries.date, from), lte(journalEntries.date, to))),
      net(lt(journalEntries.date, from)),
      net(lte(journalEntries.date, to)),
    ]);
    const toMap = (rows: { accountId: string; net: string }[]) => new Map(rows.map((r) => [r.accountId, BigInt(r.net)]));
    const moved = toMap(movedRows);
    const before = toMap(beforeRows);
    const through = toMap(throughRows);

    // Every non-cash account's movement, as cash: a debit-positive increase uses cash.
    const lines = new Map<string, { section: Placement["section"]; accounts: CashFlowAccount[]; amount: bigint; account?: Account }>();
    const cashAccounts: CashFlowAccount[] = [];
    let cashAtStart = 0n;
    let cashAtEnd = 0n;
    for (const a of chart) {
      const place = placeAccount(a, a.kind);
      if (place.section === "cash") {
        cashAtStart += before.get(a.id) ?? 0n;
        cashAtEnd += through.get(a.id) ?? 0n;
        cashAccounts.push({ id: a.id, code: a.code, name: a.name, amount: (through.get(a.id) ?? 0n).toString() });
        continue;
      }
      const effect = -(moved.get(a.id) ?? 0n);
      const line = lines.get(place.line) ?? { section: place.section, accounts: [], amount: 0n, account: a };
      line.amount += effect;
      if (effect !== 0n) line.accounts.push({ id: a.id, code: a.code, name: a.name, amount: effect.toString() });
      lines.set(place.line, line);
    }

    const netProfit = lines.get("net_profit") ?? { amount: 0n, accounts: [] };
    const operating: CashFlowLine[] = [{ key: "net_profit", label: "Net profit", amount: netProfit.amount.toString(), accounts: netProfit.accounts }];
    for (const def of OPERATING_LINES) {
      const line = lines.get(def.key);
      if (line && line.amount !== 0n) operating.push({ key: def.key, label: def.label(line.amount), amount: line.amount.toString(), accounts: line.accounts });
    }
    const perAccount = (section: CashFlowSectionKey): CashFlowLine[] =>
      [...lines.entries()]
        .filter(([, l]) => l.section === section && l.amount !== 0n)
        .map(([key, l]) => ({ key, label: l.account!.name, amount: l.amount.toString(), accounts: l.accounts }));
    const section = (key: CashFlowSectionKey, label: string, totalLabel: string, sectionLines: CashFlowLine[]): CashFlowSection => ({
      key,
      label,
      totalLabel,
      lines: sectionLines,
      total: sectionLines.reduce((s, l) => s + BigInt(l.amount), 0n).toString(),
    });
    const sections = [
      section("operating", "Operating activities", "Net cash from operating activities", operating),
      section("investing", "Investing activities", "Net cash from investing activities", perAccount("investing")),
      section("financing", "Financing activities", "Net cash from financing activities", perAccount("financing")),
    ];
    const netChange = sections.reduce((s, x) => s + BigInt(x.total), 0n);
    const ties = cashAtStart + netChange === cashAtEnd;
    if (!ties) {
      this.logger.error(`Cash flow for org ${orgId} ${from}..${to} doesn't tie: start ${cashAtStart} + change ${netChange} ≠ end ${cashAtEnd}`);
    }
    return { from, to, cashAtStart: cashAtStart.toString(), sections, netChange: netChange.toString(), cashAtEnd: cashAtEnd.toString(), cashAccounts, ties };
  }
}
