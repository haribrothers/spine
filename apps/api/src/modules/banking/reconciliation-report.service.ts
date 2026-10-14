import { Inject, Injectable } from "@nestjs/common";
import { renderToBuffer } from "@react-pdf/renderer";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { orgLocale, orgMoneySettings } from "../../common/money-format";
import { orgClock } from "../../common/org-clock";
import { loadEmailBrand } from "../email/email-brand";
import { SettingsService } from "../org/settings.service";
import { registerPdfFonts } from "../pdf/pdf-fonts";
import { MoneyAccountsService } from "./money-accounts.service";
import { ReconciliationsService } from "./reconciliations.service";
import { fileSlug } from "./register-document";
import { ReconciliationReportDocument } from "./reconciliation-report.template";

/**
 * US-BANK-17 (D-231) — a reconciliation as a PDF for the accountant: how
 * the statement and Spine agree, what's outstanding, and the matched and
 * excluded lines. Generated when asked for; never stored.
 */
@Injectable()
export class ReconciliationReportService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly reconciliations: ReconciliationsService,
    private readonly moneyAccounts: MoneyAccountsService,
    private readonly settings: SettingsService,
  ) {}

  async pdf(orgId: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const view = await this.reconciliations.get(orgId, id);
    const account = await this.moneyAccounts.get(orgId, view.moneyAccountId);
    const sense = account.kind === "card" ? -1n : 1n;
    const profile = await this.settings.get<{ name?: string; address?: string; taxId?: string }>(orgId, "business_profile");
    const brand = await loadEmailBrand(this.db, orgId);
    const { currency } = await orgMoneySettings(this.db, orgId);
    const entryById = new Map(view.entries.map((e) => [e.journalLineId, e]));
    const outstanding = view.outstanding.map((e) => ({ date: e.date, what: e.what, contact: e.contact?.name ?? null, amount: sense * BigInt(e.amount) }));
    registerPdfFonts();
    const buffer = await renderToBuffer(
      ReconciliationReportDocument({
        business: { name: profile?.name || brand.name, address: profile?.address, taxId: profile?.taxId },
        account: { name: account.name, last4: account.last4 },
        endDate: view.statementEndDate,
        currency,
        locale: await orgLocale(this.db, orgId),
        statementClosing: BigInt(view.statementClosingBalance),
        depositsOutstanding: outstanding.filter((o) => o.amount > 0n).reduce((s, o) => s + o.amount, 0n),
        paymentsOutstanding: -outstanding.filter((o) => o.amount < 0n).reduce((s, o) => s + o.amount, 0n),
        excluded: BigInt(view.excludedTotal),
        spineBalance: BigInt(view.spineBalance),
        opening: BigInt(view.openingBalance),
        matchedCount: view.matches.length,
        excludedCount: view.statementLines.filter((l) => l.status === "excluded").length,
        finished: { by: view.finishedBy?.name ?? null, at: view.finishedAt },
        outstanding,
        matched: view.statementLines
          .filter((l) => l.status === "matched")
          .map((l) => ({
            date: l.date,
            line: [l.description, l.reference].filter(Boolean).join(" · "),
            matchedTo: (view.matches.find((m) => m.statementLineId === l.id)?.journalLineIds ?? []).map((j) => entryById.get(j)?.what ?? "Entry").join(", "),
            amount: sense * BigInt(l.amount),
          })),
        excludedLines: view.statementLines.filter((l) => l.status === "excluded").map((l) => ({ date: l.date, line: l.description, note: l.excludeNote, amount: sense * BigInt(l.amount) })),
        generatedOn: orgClock().date,
      }),
    );
    return { buffer, filename: `reconciliation-${fileSlug(account.name)}-${view.statementEndDate}.pdf` };
  }
}
