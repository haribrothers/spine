import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  buildDemoPlan,
  DEMO_COUNTRIES,
  DEMO_COUNTRY_LOCKED,
  DEMO_DATA_LOADED,
  DEMO_DATA_LOADED_MESSAGE,
  DEMO_DEFAULT,
  DEMO_INDUSTRIES,
  demoCountryFor,
  demoCountryLockedMessage,
  type DemoCountry,
  type DemoDataStatus,
  type DemoIndustry,
  type TaxProfile,
} from "@spine/shared";
import { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import {
  bankReconciliations,
  bankStatementImports,
  bankStatementLineMatches,
  bankStatementLines,
  bankTransactions,
  bankTransfers,
  moneyAccounts,
  accounts,
  catalogBundles,
  catalogItems,
  contacts,
  creditNoteAllocations,
  creditNotes,
  customerRefunds,
  expenseCategories,
  expenses,
  invoices,
  jobs,
  journalEntries,
  journalLines,
  meetings as meetingsTable,
  member,
  invitation,
  teams,
  numberSequences,
  payments,
  quotes,
  settings,
  taxGroups,
  taxRates,
  vendorBills,
  vendorPayments,
  vendorCredits,
  vendorCreditAllocations,
  vendorRefunds,
  recurringBills,
} from "../../db/schema";
import { AuditLogService, type AuditEntityType } from "../audit/audit-log.service";
import { SettingsService } from "../org/settings.service";
import { FilesService } from "../files/files.service";
import { DemoSeederService, PHOTOS_SKIPPED_NOTE } from "./demo-seeder.service";

/** `settings.demo_data` — which demo is loaded, and the setup it added (D-192). */
export const DEMO_DATA_KEY = "demo_data";
export interface DemoDataSetting {
  country?: DemoCountry;
  industry?: DemoIndustry;
  businessName?: string;
  createdTaxRateIds?: string[];
  createdTaxGroupIds?: string[];
  /** US-ONB-27 — the bundles the demo made (bundles carry no demo flag). */
  createdBundleIds?: string[];
  /** US-ONB-32 — the archived category the demo added, and the categories it gave a default rate. */
  createdCategoryIds?: string[];
  defaultedCategoryIds?: string[];
}

/** `POST /demo-data/seed` — both optional; no body loads the default (US construction). */
export const seedDemoSchema = z
  .object({ country: z.enum(DEMO_COUNTRIES).optional(), industry: z.enum(DEMO_INDUSTRIES).optional() })
  .strict()
  .default({});

const isForeignKeyViolation = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code === "23503" || err?.cause?.code === "23503";
};
const swallowForeignKey = (e: unknown) => {
  if (!isForeignKeyViolation(e)) throw e;
};

/**
 * Settings › Data and the welcome screen's "Just show me around": loads a
 * demo business for a country and an industry (US-ONB-18, D-192) through
 * `DemoSeederService`, and deletes it again without a trace (US-ONB-17,
 * D-191). Every demo row carries `is_demo`.
 */
@Injectable()
export class DemoDataService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly settingsService: SettingsService,
    private readonly seeder: DemoSeederService,
    private readonly filesService: FilesService,
  ) {}

  /** Whether the business has records of its own: any journal entry that isn't demo. */
  private async hasOwnRecords(orgId: string): Promise<boolean> {
    const [own] = await this.db.select({ id: journalEntries.id }).from(journalEntries).where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.isDemo, false))).limit(1);
    return Boolean(own);
  }

  /**
   * US-ONB-18 — loads a demo business. With no records of its own, the
   * business takes the demo's country, currency, tax and template; with
   * records, the country is its own and only the industry is chosen
   * (409 `DEMO_COUNTRY_LOCKED` otherwise). Refused while demo data is
   * loaded (409 `DEMO_DATA_LOADED`).
   */
  async seed(orgId: string, actorUserId: string, input: z.input<typeof seedDemoSchema> = {}) {
    const choice = seedDemoSchema.parse(input ?? {});
    const status = await this.status(orgId);
    if (status.hasDemoData) throw new ConflictException({ error: DEMO_DATA_LOADED, message: DEMO_DATA_LOADED_MESSAGE });
    const own = status.country ?? "US";
    const country: DemoCountry = choice.country ?? (status.countryLocked ? own : DEMO_DEFAULT.country);
    if (status.countryLocked && country !== own) throw new ConflictException({ error: DEMO_COUNTRY_LOCKED, message: demoCountryLockedMessage(own) });
    const industry: DemoIndustry = choice.industry ?? DEMO_DEFAULT.industry;

    const plan = buildDemoPlan(country, industry);
    let result: Awaited<ReturnType<DemoSeederService["run"]>>;
    try {
      result = await this.seeder.run(orgId, actorUserId, plan, { locked: status.countryLocked });
    } catch (error) {
      // Nothing half-loaded is left behind: every demo row so far is this attempt's, so remove them and say what failed.
      await this.deleteAll(orgId, actorUserId).catch(() => undefined);
      throw error;
    }
    const loaded: DemoDataSetting = { country, industry, businessName: plan.business.name, createdTaxRateIds: result.createdTaxRateIds, createdTaxGroupIds: result.createdTaxGroupIds, createdBundleIds: result.createdBundleIds, createdCategoryIds: result.createdCategoryIds, defaultedCategoryIds: result.defaultedCategoryIds };
    await this.settingsService.set(orgId, DEMO_DATA_KEY, loaded);
    // US-ONB-09: loaded without its files when storage didn't take them, and says so.
    return { country, industry, businessName: plan.business.name, ...result.counts, notes: result.photosSkipped ? [PHOTOS_SKIPPED_NOTE] : [] };
  }

  /**
   * US-ONB-17 (D-191) — removes every demo row, the journal entries posted
   * for them and the demo number series, in one transaction, so nothing
   * from the demo is left in any report, export or series. This is the one
   * place journal entries are deleted: `spine.deleting_demo` lets the
   * immutability triggers delete entries flagged `is_demo`, and nothing else.
   *
   * Each document goes in its own savepoint: one that something of the
   * person's own still uses (a refund of a demo payment, say) is kept, with
   * its entries and its contact, instead of failing the whole deletion.
   * Children go before the parents that restrict them: payments before the
   * invoices they're allocated to, credit notes before their invoices,
   * documents before their jobs and contacts.
   */
  async deleteAll(orgId: string, actorUserId: string) {
    // US-ONB-31: the receipts printed for demo expenses go with them, once nothing points at them.
    const receiptFileIds: string[] = [];
    const result = await this.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('spine.deleting_demo', 'on', true)`);
      const kept = new Set<string>();

      /** Deletes one row in a savepoint; false (and kept) when something of the person's own still points at it. */
      const remove = async (id: string, run: (sp: Transaction) => Promise<unknown>, audit: { entityType: AuditEntityType; contactId: string | null; field: string; from: string | null }) => {
        try {
          await tx.transaction(async (sp) => {
            await run(sp);
            await this.auditLog.record(sp, { orgId, actorUserId, action: "deleted", entityType: audit.entityType, entityId: id, contactId: audit.contactId, changes: [{ field: audit.field, from: audit.from, to: null }] });
          });
          return true;
        } catch (error) {
          if (!isForeignKeyViolation(error)) throw error;
          kept.add(id);
          return false;
        }
      };
      const count = async <R extends { id: string }>(rows: R[], each: (row: R) => Promise<boolean>) => {
        let n = 0;
        for (const row of rows) if (await each(row)) n++;
        return n;
      };

      const vendorPaymentsDeleted = await count(
        await tx.select({ id: vendorPayments.id, number: vendorPayments.number, contactId: vendorPayments.contactId }).from(vendorPayments).where(and(eq(vendorPayments.orgId, orgId), eq(vendorPayments.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(vendorPayments).where(eq(vendorPayments.id, r.id)), { entityType: "vendor_payment", contactId: r.contactId, field: "number", from: r.number }),
      );
      const paymentsDeleted = await count(
        await tx.select({ id: payments.id, number: payments.number, contactId: payments.contactId }).from(payments).where(and(eq(payments.orgId, orgId), eq(payments.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(payments).where(eq(payments.id, r.id)), { entityType: "payment", contactId: r.contactId, field: "number", from: r.number }),
      );
      // US-ONB-29: a demo credit note's applied credit and refunds go with it (their entries are demo entries).
      const demoNoteIds = (await tx.select({ id: creditNotes.id }).from(creditNotes).where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.isDemo, true)))).map((r) => r.id);
      if (demoNoteIds.length) {
        await tx.delete(creditNoteAllocations).where(inArray(creditNoteAllocations.creditNoteId, demoNoteIds));
        await tx.delete(customerRefunds).where(inArray(customerRefunds.sourceCreditNoteId, demoNoteIds));
      }
      const creditNotesDeleted = await count(
        await tx.select({ id: creditNotes.id, number: creditNotes.number, contactId: creditNotes.contactId }).from(creditNotes).where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(creditNotes).where(eq(creditNotes.id, r.id)), { entityType: "credit_note", contactId: r.contactId, field: "number", from: r.number }),
      );
      const invoicesDeleted = await count(
        await tx.select({ id: invoices.id, number: invoices.number, contactId: invoices.contactId }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(invoices).where(eq(invoices.id, r.id)), { entityType: "invoice", contactId: r.contactId, field: "number", from: r.number }),
      );
      // US-ONB-30: demo vendor credits, with their applications and refunds (whose entries are demo entries), go before the bills.
      const demoCreditIds = (await tx.select({ id: vendorCredits.id }).from(vendorCredits).where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.isDemo, true)))).map((r) => r.id);
      if (demoCreditIds.length) {
        await tx.delete(vendorCreditAllocations).where(inArray(vendorCreditAllocations.vendorCreditId, demoCreditIds));
        await tx.delete(vendorRefunds).where(inArray(vendorRefunds.vendorCreditId, demoCreditIds));
      }
      const vendorCreditsDeleted = await count(
        await tx.select({ id: vendorCredits.id, number: vendorCredits.number, vendorReference: vendorCredits.vendorReference, contactId: vendorCredits.contactId }).from(vendorCredits).where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(vendorCredits).where(eq(vendorCredits.id, r.id)), { entityType: "vendor_credit", contactId: r.contactId, field: "number", from: r.number ?? r.vendorReference }),
      );
      const recurringBillsDeleted = await count(
        await tx.select({ id: recurringBills.id, name: recurringBills.name, contactId: recurringBills.contactId }).from(recurringBills).where(and(eq(recurringBills.orgId, orgId), eq(recurringBills.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(recurringBills).where(eq(recurringBills.id, r.id)), { entityType: "recurring_bill", contactId: r.contactId, field: "name", from: r.name }),
      );
      const vendorBillsDeleted = await count(
        await tx.select({ id: vendorBills.id, billNumber: vendorBills.billNumber, contactId: vendorBills.contactId }).from(vendorBills).where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(vendorBills).where(eq(vendorBills.id, r.id)), { entityType: "vendor_bill", contactId: r.contactId, field: "billNumber", from: r.billNumber }),
      );
      const expensesDeleted = await count(
        await tx.select({ id: expenses.id, number: expenses.number, receiptFileId: expenses.receiptFileId }).from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.isDemo, true))),
        async (r) => {
          const deleted = await remove(r.id, (sp) => sp.delete(expenses).where(eq(expenses.id, r.id)), { entityType: "expense", contactId: null, field: "number", from: r.number });
          if (deleted && r.receiptFileId) receiptFileIds.push(r.receiptFileId);
          return deleted;
        },
      );
      const quotesDeleted = await count(
        await tx.select({ id: quotes.id, number: quotes.number, contactId: quotes.contactId }).from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(quotes).where(eq(quotes.id, r.id)), { entityType: "quote", contactId: r.contactId, field: "number", from: r.number }),
      );

      // US-ONB-34: the demo's reconciliations and statement first (taking the tick off what they reconciled), then its bank entries.
      const demoRecIds = (await tx.select({ id: bankReconciliations.id }).from(bankReconciliations).where(and(eq(bankReconciliations.orgId, orgId), eq(bankReconciliations.isDemo, true)))).map((r) => r.id);
      if (demoRecIds.length) {
        await tx.update(journalLines).set({ reconciliationId: null }).where(inArray(journalLines.reconciliationId, demoRecIds));
        await tx.delete(bankStatementLineMatches).where(inArray(bankStatementLineMatches.reconciliationId, demoRecIds));
        await tx.update(bankStatementLines).set({ status: "unmatched", excludeNote: null, reconciliationId: null }).where(inArray(bankStatementLines.reconciliationId, demoRecIds));
      }
      const demoImportIds = (await tx.select({ id: bankStatementImports.id }).from(bankStatementImports).where(and(eq(bankStatementImports.orgId, orgId), eq(bankStatementImports.isDemo, true)))).map((r) => r.id);
      if (demoImportIds.length) {
        const demoLineIds = (await tx.select({ id: bankStatementLines.id }).from(bankStatementLines).where(inArray(bankStatementLines.importId, demoImportIds))).map((r) => r.id);
        if (demoLineIds.length) await tx.delete(bankStatementLineMatches).where(inArray(bankStatementLineMatches.statementLineId, demoLineIds));
        await tx.delete(bankStatementLines).where(inArray(bankStatementLines.importId, demoImportIds));
        await tx.delete(bankStatementImports).where(inArray(bankStatementImports.id, demoImportIds));
      }
      if (demoRecIds.length) await tx.delete(bankReconciliations).where(inArray(bankReconciliations.id, demoRecIds));
      const bankTransfersDeleted = await count(
        await tx.select({ id: bankTransfers.id, reference: bankTransfers.reference }).from(bankTransfers).where(and(eq(bankTransfers.orgId, orgId), eq(bankTransfers.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(bankTransfers).where(eq(bankTransfers.id, r.id)), { entityType: "bank_transfer", contactId: null, field: "reference", from: r.reference }),
      );
      const bankTransactionsDeleted = await count(
        await tx.select({ id: bankTransactions.id, description: bankTransactions.description, contactId: bankTransactions.contactId }).from(bankTransactions).where(and(eq(bankTransactions.orgId, orgId), eq(bankTransactions.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(bankTransactions).where(eq(bankTransactions.id, r.id)), { entityType: "bank_transaction", contactId: r.contactId, field: "description", from: r.description }),
      );

      // The demo's journal entries, except those of a document that was kept.
      // A bank statement line matched to one goes back to unmatched first.
      const demoEntries = (await tx.select({ id: journalEntries.id, sourceId: journalEntries.sourceId }).from(journalEntries).where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.isDemo, true)))).filter((e) => !kept.has(e.sourceId));
      const entryIds = demoEntries.map((e) => e.id);
      if (entryIds.length) {
        const lineIds = (await tx.select({ id: journalLines.id }).from(journalLines).where(inArray(journalLines.entryId, entryIds))).map((l) => l.id);
        const matched = lineIds.length ? await tx.select({ statementLineId: bankStatementLineMatches.statementLineId }).from(bankStatementLineMatches).where(inArray(bankStatementLineMatches.journalLineId, lineIds)) : [];
        if (matched.length) {
          const statementLineIds = [...new Set(matched.map((m) => m.statementLineId))];
          await tx.delete(bankStatementLineMatches).where(inArray(bankStatementLineMatches.statementLineId, statementLineIds));
          await tx.update(bankStatementLines).set({ status: "unmatched", reconciliationId: null }).where(inArray(bankStatementLines.id, statementLineIds));
        }
        await tx.delete(journalEntries).where(inArray(journalEntries.id, entryIds));
      }

      // US-ONB-34: the demo's card account, and its ledger account, once its entries are gone.
      const moneyAccountsDeleted = await count(
        await tx.select({ id: moneyAccounts.id, name: moneyAccounts.name, accountId: moneyAccounts.accountId }).from(moneyAccounts).where(and(eq(moneyAccounts.orgId, orgId), eq(moneyAccounts.isDemo, true))),
        (r) =>
          remove(
            r.id,
            async (sp) => {
              await sp.delete(moneyAccounts).where(eq(moneyAccounts.id, r.id));
              await sp.delete(accounts).where(eq(accounts.id, r.accountId));
            },
            { entityType: "money_account", contactId: null, field: "name", from: r.name },
          ),
      );

      const jobsDeleted = await count(
        await tx.select({ id: jobs.id, name: jobs.name, contactId: jobs.contactId }).from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(jobs).where(eq(jobs.id, r.id)), { entityType: "job", contactId: r.contactId, field: "name", from: r.name }),
      );
      const meetingsDeleted = await count(
        await tx.select({ id: meetingsTable.id, title: meetingsTable.title, contactId: meetingsTable.contactId }).from(meetingsTable).where(and(eq(meetingsTable.orgId, orgId), eq(meetingsTable.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(meetingsTable).where(eq(meetingsTable.id, r.id)), { entityType: "meeting", contactId: r.contactId, field: "title", from: r.title }),
      );
      const demoContacts = await tx.select({ id: contacts.id, name: contacts.name }).from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.isDemo, true)));
      const contactsDeleted = await count(demoContacts, (r) => remove(r.id, (sp) => sp.delete(contacts).where(eq(contacts.id, r.id)), { entityType: "contact", contactId: null, field: "name", from: r.name }));
      const catalogItemsDeleted = await count(
        await tx.select({ id: catalogItems.id, name: catalogItems.name }).from(catalogItems).where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.isDemo, true))),
        (r) => remove(r.id, (sp) => sp.delete(catalogItems).where(eq(catalogItems.id, r.id)), { entityType: "catalog_item", contactId: null, field: "name", from: r.name }),
      );

      // What the demo itself added to the organisation's setup: the tax
      // rates and group it created (recorded when it was loaded; Riverstone
      // from before then is found by name), once nothing uses them.
      const loaded = await this.settingsService.get<DemoDataSetting>(orgId, DEMO_DATA_KEY);
      // US-ONB-27: and the bundles it made.
      const bundleIds = loaded?.createdBundleIds ?? [];
      const bundlesDeleted = bundleIds.length ? (await tx.delete(catalogBundles).where(and(eq(catalogBundles.orgId, orgId), inArray(catalogBundles.id, bundleIds))).returning({ id: catalogBundles.id })).length : 0;
      const groupIds = loaded?.createdTaxGroupIds ?? (await tx.select({ id: taxGroups.id }).from(taxGroups).where(and(eq(taxGroups.orgId, orgId), eq(taxGroups.name, "Sales Tax + Surcharge")))).map((g) => g.id);
      const rateIds = loaded?.createdTaxRateIds ?? (await tx.select({ id: taxRates.id }).from(taxRates).where(and(eq(taxRates.orgId, orgId), inArray(taxRates.name, ["Sales Tax", "State Surcharge"])))).map((r) => r.id);
      for (const id of groupIds) await tx.transaction((sp) => sp.delete(taxGroups).where(and(eq(taxGroups.orgId, orgId), eq(taxGroups.id, id)))).catch(swallowForeignKey);
      for (const id of rateIds) await tx.transaction((sp) => sp.delete(taxRates).where(and(eq(taxRates.orgId, orgId), eq(taxRates.id, id)))).catch(swallowForeignKey);
      // US-ONB-32: the category the demo added goes (unless something now uses it), and the defaults it set are cleared.
      for (const id of loaded?.createdCategoryIds ?? []) await tx.transaction((sp) => sp.delete(expenseCategories).where(and(eq(expenseCategories.orgId, orgId), eq(expenseCategories.id, id)))).catch(swallowForeignKey);
      if (loaded?.defaultedCategoryIds?.length) await tx.update(expenseCategories).set({ defaultTaxRateId: null }).where(and(eq(expenseCategories.orgId, orgId), inArray(expenseCategories.id, loaded.defaultedCategoryIds)));
      if (!loaded) {
        // Riverstone loaded before US-ONB-20 made its own categories outside a template.
        await tx
          .delete(expenseCategories)
          .where(and(eq(expenseCategories.orgId, orgId), inArray(expenseCategories.name, ["Fuel & Vehicle", "Site Meals", "Tools & Small Equipment"])))
          .catch(swallowForeignKey);
      }

      // The demo Staff and Field people lose access here; their logins stay (member.isDemo's own comment).
      const membersDeleted = (await tx.delete(member).where(and(eq(member.organizationId, orgId), eq(member.isDemo, true))).returning({ id: member.id })).length;
      // US-ONB-35: the demo's invites (their Teams cascade) and its "Accounts" Team (its grants and memberships cascade).
      const invitesDeleted = (await tx.delete(invitation).where(and(eq(invitation.organizationId, orgId), eq(invitation.isDemo, true))).returning({ id: invitation.id })).length;
      const teamsDeleted = (await tx.delete(teams).where(and(eq(teams.orgId, orgId), eq(teams.isDemo, true))).returning({ id: teams.id })).length;

      // A demo loaded again starts its series at 0001.
      await tx.delete(numberSequences).where(and(eq(numberSequences.orgId, orgId), eq(numberSequences.isDemo, true)));
      await tx.delete(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, DEMO_DATA_KEY)));

      return {
        contactsDeleted,
        catalogItemsDeleted,
        bundlesDeleted,
        quotesDeleted,
        invoicesDeleted,
        paymentsDeleted,
        jobsDeleted,
        vendorPaymentsDeleted,
        bankTransfersDeleted,
        bankTransactionsDeleted,
        moneyAccountsDeleted,
        vendorBillsDeleted,
        vendorCreditsDeleted,
        recurringBillsDeleted,
        expensesDeleted,
        creditNotesDeleted,
        meetingsDeleted,
        membersDeleted,
        invitesDeleted,
        teamsDeleted,
        kept: { contacts: demoContacts.length - contactsDeleted },
      };
    });
    for (const id of receiptFileIds) {
      if ((await this.filesService.owningRecords(orgId, id)).length) continue;
      await this.filesService.deleteStored(orgId, id).catch(() => undefined);
    }
    return result;
  }

  /**
   * Whether demo data is loaded (the demo recorded when it was loaded, or —
   * for one loaded before that — any demo catalogue item, quote or
   * invoice), which one, and what the picker may offer. A demo contact kept
   * because the person's own records use it doesn't count.
   */
  async status(orgId: string): Promise<DemoDataStatus> {
    const loaded = await this.settingsService.get<DemoDataSetting>(orgId, DEMO_DATA_KEY);
    let hasDemoData = Boolean(loaded);
    if (!hasDemoData) {
      const [demoItem] = await this.db.select({ id: catalogItems.id }).from(catalogItems).where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.isDemo, true))).limit(1);
      const [demoQuote] = await this.db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.isDemo, true))).limit(1);
      const [demoInvoice] = await this.db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.isDemo, true))).limit(1);
      hasDemoData = Boolean(demoItem || demoQuote || demoInvoice);
    }
    const taxCountry = (await this.settingsService.get<TaxProfile>(orgId, "tax_profile"))?.country;
    return {
      hasDemoData,
      loaded: loaded?.country && loaded.industry ? { country: loaded.country, industry: loaded.industry, businessName: loaded.businessName ?? "" } : null,
      country: taxCountry ? demoCountryFor(taxCountry) : null,
      countryLocked: await this.hasOwnRecords(orgId),
    };
  }
}
