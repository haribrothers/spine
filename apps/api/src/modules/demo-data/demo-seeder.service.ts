import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import { itemTaxFor, type DemoPlan, type DemoPlanContact, type DemoPlanLead, type DemoPlanLine, type DemoPlanQuote, type DemoTax, type DemoTaxRef, type SupplyClass, type SupplyType, type TaxProfile } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts, activities, addresses, auditLog, catalogItems, contactPersons, contacts, expenseCategories, invoiceLines, invoiceReminders, invoices, jobAssignments, jobPhotos, leads, leadStages, meetings as meetingsTable, member, milestones as milestonesTable, paymentAllocations, payments, quoteEvents, quotes, teamMemberships, user, account } from "../../db/schema";
import { hashPassword } from "../../auth/password";
import { orgClock } from "../../common/org-clock";
import { AuditLogService } from "../audit/audit-log.service";
import { CatalogBundlesService } from "../catalog/catalog-bundles.service";
import { LeadStagesService } from "../contacts/lead-stages.service";
import { MeetingsService } from "../contacts/meetings.service";
import { CreditNotesService } from "../credit-notes/credit-notes.service";
import { FilesService } from "../files/files.service";
import { InvoicesService } from "../invoices/invoices.service";
import { costByJob } from "../jobs/job-costing.service";
import { JobsService } from "../jobs/jobs.service";
import { MilestonesService } from "../jobs/milestones.service";
import { VariationOrdersService } from "../jobs/variation-orders.service";
import { IndustryTemplateService } from "../org/industry-template.service";
import { SettingsService } from "../org/settings.service";
import { PaymentsService } from "../payments/payments.service";
import { ExpensesService } from "../purchases/expenses.service";
import { VendorBillsService } from "../purchases/vendor-bills.service";
import { VendorPaymentsService } from "../purchases/vendor-payments.service";
import { PublicQuotesService } from "../quotes/public-quotes.service";
import { QuotePublicTokenService } from "../quotes/quote-public-token.service";
import { QuotesService } from "../quotes/quotes.service";
import { PlaceOfSupplyService } from "../tax/place-of-supply.service";
import { TaxGroupsService } from "../tax/tax-groups.service";
import { TaxProfileService } from "../tax/tax-profile.service";
import { TaxRatesService } from "../tax/tax-rates.service";
import { TeamsService } from "../teams/teams.service";

/**
 * A minimal, valid 1x1 px PNG — the demo's logo goes through the real
 * `FilesService.upload`, so it's served like any other file.
 */
const PLACEHOLDER_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/**
 * US-JOB-38 (D-215) — real site photos for the demo's jobs, bundled in
 * `apps/api/assets/demo` (Unsplash License; sources in SOURCES.md there).
 * The first is each job's kick-off photo in turn; the rest go with
 * completed milestones.
 */
const DEMO_PHOTOS_DIR = path.resolve(__dirname, "../../../assets/demo");
export const DEMO_SITE_PHOTOS = ["site-structure.jpg", "site-foundations.jpg", "site-framing.jpg", "site-works.jpg", "site-crew.jpg", "site-hard-hat.jpg"] as const;

/** The two demo people every demo shares (real logins; their memberships are demo rows). */
const DEMO_USER_PASSWORD = "DemoPassword123!";
const DEMO_USERS: { email: string; name: string; role: "staff" | "field"; joinDefaultTeam: boolean }[] = [
  { email: "sarah.mendes.demo@example.com", name: "Sarah Mendes", role: "staff", joinDefaultTeam: true },
  { email: "marcus.webb.demo@example.com", name: "Marcus Webb", role: "field", joinDefaultTeam: false },
];

interface TaxIds {
  taxRateId: string | null;
  taxGroupId: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SeedResult {
  createdTaxRateIds: string[];
  createdTaxGroupIds: string[];
  /** US-ONB-27 — bundles carry no demo flag, so the ones made are recorded and deleted with the demo. */
  createdBundleIds: string[];
  counts: Record<string, number>;
}

/**
 * US-ONB-18 (D-192) — runs a demo plan (`buildDemoPlan`) through the real
 * services, so every number, total, tax split and journal entry is what a
 * person's own clicks would have made. A business without records of its
 * own takes the plan's country, currency, tax and template; one with
 * records keeps its settings ("locked") and only gains the template's
 * accounts and categories and any preset rates the demo needs.
 *
 * Every dated step — issuing an invoice, a payment, recording a bill,
 * approving an expense, invoicing a milestone — runs in date order, so
 * document numbers follow their dates. Riverstone keeps its own order
 * ("declared"): everything today, as it always was.
 */
@Injectable()
export class DemoSeederService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly settingsService: SettingsService,
    private readonly industryTemplate: IndustryTemplateService,
    private readonly taxProfile: TaxProfileService,
    private readonly taxRatesService: TaxRatesService,
    private readonly taxGroupsService: TaxGroupsService,
    private readonly placeOfSupply: PlaceOfSupplyService,
    private readonly leadStagesService: LeadStagesService,
    private readonly quotesService: QuotesService,
    private readonly invoicesService: InvoicesService,
    private readonly paymentsService: PaymentsService,
    private readonly creditNotesService: CreditNotesService,
    private readonly jobsService: JobsService,
    private readonly milestonesService: MilestonesService,
    private readonly variationOrdersService: VariationOrdersService,
    private readonly vendorBillsService: VendorBillsService,
    private readonly vendorPaymentsService: VendorPaymentsService,
    private readonly expensesService: ExpensesService,
    private readonly meetingsService: MeetingsService,
    private readonly filesService: FilesService,
    private readonly teamsService: TeamsService,
    private readonly catalogBundles: CatalogBundlesService,
    private readonly publicQuotes: PublicQuotesService,
    private readonly publicTokens: QuotePublicTokenService,
  ) {}

  async run(orgId: string, actorUserId: string, plan: DemoPlan, options: { locked: boolean }): Promise<SeedResult> {
    const counts: Record<string, number> = {};
    const count = (key: string, n = 1) => (counts[key] = (counts[key] ?? 0) + n);
    const today = orgClock().date;
    /** Midnight UTC of a day relative to the organisation's today, which is how dates are stored. */
    const day = (offset: number) => new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) + offset));
    /** D-216 — a moment `offset` days from now, for timestamps set the way the app would have written them that day. */
    const when = (offset: number) => new Date(Date.now() + offset * DAY_MS);
    /** Kept within this month, so it counts as "this month" whatever today's date is. */
    const thisMonth = (offset: number) => Math.max(offset, -(+today.slice(8, 10) - 1));
    /** Moves an entity's audit rows (all, or those with the given actions) to a day, as if they'd happened then. */
    const backdateAudit = async (entityId: string, when: Date, actions?: string[]) =>
      this.db
        .update(auditLog)
        .set({ createdAt: when })
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityId, entityId), ...(actions ? [inArray(auditLog.action, actions)] : [])));
    const currency = plan.currency.code;

    // 1. The business itself.
    if (options.locked) {
      await this.industryTemplate.seedTemplate(this.db, orgId, actorUserId, plan.template);
    } else {
      await this.applySettings(orgId, actorUserId, plan);
    }
    if (plan.taxCountry !== "other" && options.locked) await this.taxProfile.update(orgId, actorUserId, { country: plan.taxCountry });

    // 2. Taxes: the preset's (set with the country) and any the demo adds itself.
    const created = await this.ensureOwnTaxes(orgId, actorUserId, plan);
    // A rate in use wins over an archived one of the same name.
    const allRates = await this.taxRatesService.list(orgId, { includeArchived: true });
    const rates = new Map([...allRates.filter((r) => r.archivedAt !== null), ...allRates.filter((r) => r.archivedAt === null)].map((r) => [r.name, { id: r.id, rate: Number(r.rate) }]));
    const groups = new Map((await this.taxGroupsService.list(orgId, { includeArchived: true })).map((g) => [g.name, { id: g.id, rate: g.taxRates.reduce((sum, r) => sum + Number(r.rate), 0) }]));
    const ids = (ref: DemoTaxRef | null | undefined): TaxIds => ({ taxRateId: ref?.rate ? (rates.get(ref.rate)?.id ?? null) : null, taxGroupId: ref?.group ? (groups.get(ref.group)?.id ?? null) : null });
    const percent = (ref: DemoTaxRef | null | undefined) => (ref?.rate ? (rates.get(ref.rate)?.rate ?? 0) : ref?.group ? (groups.get(ref.group)?.rate ?? 0) : 0);

    // The demo Staff and Field people come first, so leads can belong to them (US-ONB-24).
    count("usersCreated", await this.seedDemoUsers(orgId));
    const [staff] = await this.db.select({ id: user.id }).from(user).where(inArray(user.email, DEMO_USERS.filter((u) => u.role === "staff").map((u) => u.email)));
    const ownerOf = (lead: DemoPlanLead) => (lead.owner === "staff" && staff ? staff.id : actorUserId);
    // US-ONB-27: goods post to 4000 Sales — Goods.
    const [goodsAccount] = await this.db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "4000")));
    const jobContacts = new Set(plan.jobs.map((j) => j.contact));

    // 3. Contacts and the catalogue, in one transaction.
    const contactIds = new Map<string, string>();
    const leadIds = new Map<string, string>();
    const lostLeadIds = new Map<string, string>();
    const itemIds = new Map<string, string>();
    await this.db.transaction(async (tx) => {
      await this.leadStagesService.ensureSeeded(orgId, tx);
      const stages = await tx.select().from(leadStages).where(eq(leadStages.orgId, orgId)).orderBy(asc(leadStages.sortOrder));
      const open = stages.filter((st) => st.kind === "open");
      const stageIdFor = (stage: NonNullable<DemoPlanContact["lead"]>["stage"]) =>
        stage === "won" || stage === "lost" ? stages.find((st) => st.kind === stage)!.id : (open[{ new: 0, qualified: 1, proposal: 2 }[stage]] ?? open[open.length - 1]!).id;
      /** The stages a lead went through to reach its own, a week apart. */
      const stagePath = (stage: DemoPlanLead["stage"]) => {
        const opens = open.slice(0, Math.min(open.length, stage === "new" ? 1 : stage === "qualified" ? 2 : 3)).map((st) => st.id);
        return stage === "won" || stage === "lost" ? [...opens, stageIdFor(stage)] : opens.length ? opens : [stageIdFor(stage)];
      };
      /** US-ONB-24 — a lead as a team would have worked it: owner, dated stages, expected close, lost reason, and its history. */
      const insertLead = async (contactId: string, lead: DemoPlanLead) => {
        const changedAt = when(-(lead.daysInStage ?? 0));
        const path = stagePath(lead.stage);
        const createdAt = new Date(changedAt.getTime() - (path.length - 1) * 7 * DAY_MS);
        const [row] = await tx
          .insert(leads)
          .values({
            orgId,
            contactId,
            stageId: path[path.length - 1]!,
            valueAmount: lead.value,
            valueCurrency: currency,
            source: lead.source,
            title: lead.title,
            ownerUserId: ownerOf(lead),
            stageChangedAt: changedAt,
            expectedCloseDate: lead.expectedCloseInDays === undefined ? null : day(lead.expectedCloseInDays).toISOString().slice(0, 10),
            lostReason: lead.lostReason ?? null,
            lostNote: lead.lostNote ?? null,
            createdAt,
            updatedAt: changedAt,
          })
          .returning();
        await tx.insert(auditLog).values(
          path.map((stageId, i) => ({
            orgId,
            actorUserId: ownerOf(lead),
            action: i === 0 ? "created" : "updated",
            entityType: "lead" as const,
            entityId: row!.id,
            contactId,
            changes: [{ field: "stageId", from: i === 0 ? null : path[i - 1]!, to: stageId }],
            createdAt: new Date(createdAt.getTime() + i * 7 * DAY_MS),
          })),
        );
        count("leadsCreated");
        return row!;
      };

      for (const seed of plan.contacts) {
        const [contact] = await tx
          .insert(contacts)
          .values({ orgId, type: seed.type, isCompany: seed.isCompany, name: seed.name, email: seed.email, phone: seed.phone, taxId: seed.taxId ?? null, website: seed.website ?? null, gstTreatment: seed.gstTreatment ?? null, stateCode: seed.stateCode ?? null, isDemo: true })
          .returning();
        contactIds.set(seed.key, contact!.id);
        count("contactsCreated");
        await this.auditLog.record(tx, { orgId, actorUserId, action: "created", entityType: "contact", entityId: contact!.id, contactId: contact!.id, changes: [{ field: "name", from: null, to: contact!.name }] });
        await tx.insert(contactPersons).values({ contactId: contact!.id, name: seed.person.name, title: seed.person.title, email: seed.person.email, phone: seed.person.phone, isPrimary: true });
        await tx.insert(addresses).values({ contactId: contact!.id, type: "billing", line1: seed.address.line1, city: seed.address.city, state: seed.address.state, stateCode: seed.address.stateCode ?? null, postalCode: seed.address.postalCode, country: seed.address.country, isPrimary: true });
        // US-ONB-26: a customer with a job has its site address too.
        if (jobContacts.has(seed.key)) {
          await tx.insert(addresses).values({ contactId: contact!.id, type: "site", line1: seed.address.line1, city: seed.address.city, state: seed.address.state, stateCode: seed.address.stateCode ?? null, postalCode: seed.address.postalCode, country: seed.address.country, isPrimary: false });
        }
        let lead: { id: string; stageChangedAt: Date; ownerUserId: string | null } | null = null;
        if (seed.lead) {
          lead = await insertLead(contact!.id, seed.lead);
          leadIds.set(seed.key, lead.id);
        }
        if (seed.lostLead) lostLeadIds.set(seed.key, (await insertLead(contact!.id, seed.lostLead)).id);
        if (seed.activity) {
          const dueAt = new Date();
          dueAt.setDate(dueAt.getDate() + seed.activity.dueInDays);
          await tx.insert(activities).values({
            orgId,
            contactId: contact!.id,
            leadId: lead?.id ?? null,
            type: seed.activity.type,
            notes: seed.activity.notes,
            dueAt,
            doneAt: seed.activity.dueInDays < 0 ? dueAt : null,
            assignedToUserId: lead?.ownerUserId ?? actorUserId,
            createdByUserId: actorUserId,
            // The cold lead's only activity was logged when it last moved, so it shows "No activity for 14 days".
            ...(seed.lead?.cold && lead ? { createdAt: lead.stageChangedAt } : {}),
          });
        }
      }

      for (const seed of plan.items) {
        const intra = ids(seed.tax.intra);
        const inter = ids(seed.tax.inter);
        const [item] = await tx
          .insert(catalogItems)
          .values({
            orgId,
            name: seed.name,
            description: seed.description,
            unit: seed.unit,
            category: seed.category,
            defaultPriceAmount: seed.price,
            defaultPriceCurrency: currency,
            defaultTaxRatePercentage: percent(seed.tax.intra),
            defaultTaxRateId: intra.taxRateId,
            defaultTaxGroupId: intra.taxGroupId,
            interTaxRateId: inter.taxRateId,
            interTaxGroupId: inter.taxGroupId,
            supplyClass: seed.tax.intra ? "taxable" : (seed.tax.supplyClass ?? "zero_rated"),
            hsnSac: seed.hsnSac ?? null,
            incomeAccountId: seed.income === "goods" ? (goodsAccount?.id ?? null) : null,
            isDemo: true,
          })
          .returning();
        itemIds.set(seed.key, item!.id);
        count("catalogItemsCreated");
        await this.auditLog.record(tx, { orgId, actorUserId, action: "created", entityType: "catalog_item", entityId: item!.id, contactId: null, changes: [{ field: "name", from: null, to: item!.name }] });
      }
    });

    // Lines take the tax the app itself would choose for the document's place of supply (US-TAX-13).
    const profile = (await this.settingsService.get<TaxProfile>(orgId, "tax_profile")) ?? {};
    const exportOptions = { exportUnderLut: profile.exportUnderLut === true };
    const supplyFor = async (contactKey: string, direction: "sale" | "purchase") => this.placeOfSupply.resolve(orgId, contactIds.get(contactKey)!, undefined, direction);
    const taxFor = (tax: DemoTax | null, supplyType: SupplyType | null): TaxIds & { supplyClass?: SupplyClass } => {
      if (!tax) return { taxRateId: null, taxGroupId: null };
      const intra = ids(tax.intra);
      const inter = tax.inter ? ids(tax.inter) : { taxRateId: null, taxGroupId: null };
      const chosen = itemTaxFor({ defaultTaxRateId: intra.taxRateId, defaultTaxGroupId: intra.taxGroupId, interTaxRateId: inter.taxRateId, interTaxGroupId: inter.taxGroupId }, supplyType, exportOptions);
      if (chosen.taxRateId || chosen.taxGroupId) return chosen;
      return { ...chosen, supplyClass: tax.intra ? "zero_rated" : (tax.supplyClass ?? "zero_rated") };
    };
    const itemByKey = new Map(plan.items.map((i) => [i.key, i]));
    const lineInputs = (lines: DemoPlanLine[], supplyType: SupplyType | null, zeroRated = false) =>
      lines.map((line) => {
        if ("item" in line) {
          const item = itemByKey.get(line.item)!;
          const tax = zeroRated ? { taxRateId: null, taxGroupId: null, supplyClass: "zero_rated" as const } : taxFor(line.tax ?? item.tax, supplyType);
          return {
            type: "item" as const,
            catalogItemId: itemIds.get(line.item)!,
            name: item.name,
            description: item.description,
            quantity: line.quantity,
            unitPriceAmount: item.price,
            discountPercentage: line.discount ?? 0,
            taxRatePercentage: 0,
            isTaxInclusive: false,
            ...tax,
            ...(item.hsnSac ? { hsnSac: item.hsnSac } : {}),
          };
        }
        return {
          type: "item" as const,
          name: line.name,
          description: line.description ?? null,
          quantity: line.quantity,
          unitPriceAmount: line.price,
          unitPriceCurrency: currency,
          discountPercentage: 0,
          taxRatePercentage: 0,
          isTaxInclusive: false,
          ...taxFor(line.tax, supplyType),
          ...(line.hsnSac ? { hsnSac: line.hsnSac } : {}),
        };
      });

    // US-ONB-27: bundles made from the catalogue's items.
    const createdBundleIds: string[] = [];
    for (const seed of plan.bundles) {
      const bundle = await this.catalogBundles.create(orgId, actorUserId, { name: seed.name, description: seed.description, items: seed.items.map(([key, quantity]) => ({ catalogItemId: itemIds.get(key)!, quantity })) });
      createdBundleIds.push(bundle.id);
      count("bundlesCreated");
    }

    /**
     * US-ONB-25 (D-216) — a quote sent, viewed and answered as it would
     * have been: sent through `QuotesService.send`, answered through the
     * customer's link, then its dates and audit rows moved to the plan's
     * days and the customer's views added.
     */
    const sentOn = async (quoteId: string, offset: number) => {
      const sentAt = when(offset);
      await this.db.update(quotes).set({ sentAt, createdAt: new Date(sentAt.getTime() - 60 * 60 * 1000) }).where(eq(quotes.id, quoteId));
      await backdateAudit(quoteId, sentAt, ["sent"]);
      await backdateAudit(quoteId, new Date(sentAt.getTime() - 60 * 60 * 1000), ["created", "discount_approved", "revised"]);
    };
    const viewed = async (quoteId: string, views: { count: number; lastInDays: number }, sentInDays: number) => {
      const span = Math.max(views.lastInDays - sentInDays, 0);
      await this.db.insert(quoteEvents).values(
        Array.from({ length: views.count }, (_, i) => ({
          quoteId,
          orgId,
          type: "viewed" as const,
          createdAt: when(views.count === 1 ? views.lastInDays : sentInDays + (span * (i + 1)) / views.count),
        })),
      );
    };
    const answer = async (quoteId: string, outcome: "accepted" | "declined", offset: number, comment?: string) => {
      const token = await this.db.transaction((tx) => this.publicTokens.issue(tx, orgId, quoteId));
      const provenance = { ipAddress: null, userAgent: "Spine demo data" };
      if (outcome === "accepted") await this.publicQuotes.accept(token.token, comment, provenance);
      else await this.publicQuotes.reject(token.token, comment, provenance);
      const respondedAt = when(offset);
      await this.db.update(quotes).set({ respondedAt }).where(eq(quotes.id, quoteId));
      await this.db.update(quoteEvents).set({ createdAt: respondedAt }).where(and(eq(quoteEvents.quoteId, quoteId), inArray(quoteEvents.type, ["accepted", "rejected"])));
    };
    const runQuote = async (seed: DemoPlanQuote, lines: ReturnType<typeof lineInputs>, leadId: string | null) => {
      const supply = await supplyFor(seed.contact, "sale");
      const quote = await this.quotesService.create(
        orgId,
        actorUserId,
        {
          contactId: contactIds.get(seed.contact)!,
          title: seed.title,
          leadId,
          currency,
          validUntil: day(seed.validUntilInDays),
          notes: seed.notes ?? null,
          termsAndConditions: seed.terms ?? null,
          lines,
          ...(supply.placeOfSupply ? { placeOfSupply: supply.placeOfSupply } : {}),
        } as never,
        true,
      );
      count("quotesCreated");
      if (seed.outcome === "draft") return quote;
      // A discount over the approval threshold is approved the way an owner would (US-QUO-09).
      if (quote.discountRequiresApproval) await this.quotesService.approveDiscount(orgId, quote.id, actorUserId);
      await this.quotesService.send(orgId, quote.id, actorUserId);
      count("quotesSent");
      const sentInDays = seed.sentInDays ?? 0;
      await sentOn(quote.id, sentInDays);
      if (seed.views) await viewed(quote.id, seed.views, sentInDays);
      if (seed.outcome === "revised") {
        const revision = await this.quotesService.revise(orgId, quote.id, actorUserId);
        await this.quotesService.send(orgId, revision.id, actorUserId);
        await sentOn(revision.id, seed.revisedInDays ?? 0);
        count("quotesRevised");
        count("quotesSent");
      }
      if (seed.outcome === "accepted" || seed.outcome === "declined") {
        const respondedIn = seed.respondedInDays ?? 0;
        await answer(quote.id, seed.outcome, seed.thisMonth ? thisMonth(respondedIn) : respondedIn, seed.comment);
        count(seed.outcome === "accepted" ? "quotesAccepted" : "quotesDeclined");
      }
      return quote;
    };

    // 4. Quotes, sent, viewed and answered on their days.
    for (const seed of plan.quotes) {
      const supply = await supplyFor(seed.contact, "sale");
      await runQuote(seed, lineInputs(seed.lines, supply.supplyType), (seed.forLostLead ? lostLeadIds : leadIds).get(seed.contact) ?? null);
    }

    // 5. Jobs, before the timeline that invoices their milestones.
    const photoFileIds: string[] = [];
    if (this.filesService.isStorageConfigured()) {
      for (const name of DEMO_SITE_PHOTOS) {
        const file = await this.filesService.upload(orgId, { originalFilename: name, mimeType: "image/jpeg", buffer: readFileSync(path.join(DEMO_PHOTOS_DIR, name)), uploadedByUserId: actorUserId });
        if (file) photoFileIds.push(file.id);
      }
    }
    const photoFor = (n: number): string | null => (photoFileIds.length ? photoFileIds[n % photoFileIds.length]! : null);
    const jobRows = new Map<string, { id: string; name: string; contact: string; milestoneIds: string[]; index: number }>();
    for (const [jobIndex, seed] of plan.jobs.entries()) {
      const photoFileId = photoFor(jobIndex);
      // US-ONB-25: made from its accepted contract quote — one lump-sum line at the contract value, with the job's milestone tax.
      let sourceQuoteId: string | undefined;
      if (seed.fromQuote) {
        const supply = await supplyFor(seed.contact, "sale");
        const lump = lineInputs([{ name: `${seed.name} — contract`, quantity: 1, price: seed.contractValue, tax: seed.milestoneTax?.tax ?? null, ...(seed.milestoneTax?.hsnSac ? { hsnSac: seed.milestoneTax.hsnSac } : {}) }], supply.supplyType);
        const quote = await runQuote(
          {
            contact: seed.contact,
            title: seed.fromQuote.title,
            validUntilInDays: seed.fromQuote.sentInDays + 30,
            notes: `${seed.name} — contract price, billed in the milestones agreed.`,
            lines: [],
            outcome: "accepted",
            sentInDays: seed.fromQuote.sentInDays,
            views: { count: 1, lastInDays: seed.fromQuote.viewedInDays },
            respondedInDays: seed.fromQuote.respondedInDays,
            comment: "Signed off — let's start.",
          },
          lump,
          leadIds.get(seed.contact) ?? null,
        );
        sourceQuoteId = quote.id;
      }
      const job = await this.jobsService.create(
        orgId,
        actorUserId,
        { contactId: contactIds.get(seed.contact)!, name: seed.name, siteAddress: seed.siteAddress, currency, startDate: day(seed.startInDays), endDate: day(seed.endInDays), contractValueAmount: seed.contractValue, retentionPct: seed.retentionPct, notes: null } as never,
        true,
        sourceQuoteId,
      );
      count("jobsCreated");
      await this.jobsService.addNote(orgId, job.id, actorUserId, { body: seed.note });
      if (photoFileId) {
        await this.jobsService.addPhoto(orgId, job.id, actorUserId, { fileId: photoFileId, caption: seed.photoCaption });
        count("jobPhotosCreated");
      }
      const milestones = await this.milestonesService.setAll(orgId, job.id, actorUserId, {
        milestones: seed.milestones.map((m, i) => ({ name: m.name, sequence: i, amountType: m.amountType, amount: m.amount, dueDate: day(m.dueInDays) })),
      } as never);
      // The job's own story starts on its start day (US-JOB-37).
      const started = when(seed.startInDays);
      await backdateAudit(job.id, started);
      await this.db.update(jobPhotos).set({ createdAt: started }).where(eq(jobPhotos.jobId, job.id));
      jobRows.set(seed.key, { id: job.id, name: seed.name, contact: seed.contact, milestoneIds: milestones.map((m: { id: string }) => m.id), index: jobIndex });
    }

    // 6. The timeline. Each step has a day; "dated" plans run in day order.
    const steps: { day: number; run: () => Promise<void> }[] = [];
    const at = (offset: number | null | undefined, run: () => Promise<void>) => steps.push({ day: offset ?? 0, run });
    const invoiceIds = new Map<string, string>();
    const drafts: (() => Promise<void>)[] = [];

    const pay = async (invoiceId: string, contactKey: string, onDay: number | null, amount: "full" | number, method: string = "bank_transfer") => {
      const [invoice] = await this.db.select().from(invoices).where(eq(invoices.id, invoiceId));
      const outstanding = invoice!.totalAmount - invoice!.retentionAmount - invoice!.amountPaid - invoice!.creditedAmount;
      const payAmount = amount === "full" ? (invoice!.amountPaid === 0n ? invoice!.totalAmount - invoice!.retentionAmount : outstanding) : (invoice!.totalAmount * BigInt(Math.round(amount * 100))) / 100n;
      if (payAmount <= 0n) return;
      const payment = await this.paymentsService.create(
        orgId,
        actorUserId,
        { contactId: contactIds.get(contactKey)!, date: onDay === null ? new Date() : day(onDay), method, reference: null, currency, amount: payAmount, allocations: [{ invoiceId, amount: payAmount }] } as never,
        true,
      );
      // US-ONB-28: recorded on its day, so the invoice's Activity shows it then.
      if (onDay !== null) {
        await this.db.update(payments).set({ createdAt: when(onDay) }).where(eq(payments.id, payment.id));
        await this.db.update(paymentAllocations).set({ createdAt: when(onDay) }).where(eq(paymentAllocations.paymentId, payment.id));
      }
      count("paymentsCreated");
    };

    /** US-ONB-28 — an invoice made and issued on its day: its audit rows and timestamps moved there. */
    const issuedOn = async (invoiceId: string, offset: number) => {
      const issuedAt = when(offset);
      const createdAt = new Date(issuedAt.getTime() - 20 * 60 * 1000);
      await this.db.update(invoices).set({ issuedAt, createdAt }).where(eq(invoices.id, invoiceId));
      await backdateAudit(invoiceId, issuedAt, ["issued"]);
      await backdateAudit(invoiceId, createdAt, ["created", "updated"]);
    };
    /**
     * US-ONB-28 — emailed or reminded on its day, as the app records it, but
     * without queueing a real email to the demo's made-up customers.
     */
    const emailedOn = async (invoiceId: string, contactKey: string, offset: number) => {
      const at = when(offset);
      await this.db.update(invoices).set({ emailStatus: "sent", emailSentAt: at }).where(eq(invoices.id, invoiceId));
      await this.auditLog.record(this.db, { orgId, actorUserId, action: "email_queued", entityType: "invoice", entityId: invoiceId, contactId: contactIds.get(contactKey)!, changes: [{ field: "emailStatus", from: null, to: "pending" }] });
      await backdateAudit(invoiceId, at, ["email_queued"]);
    };
    const remindedOn = async (invoiceId: string, contactKey: string, offset: number) => {
      const at = when(offset);
      await this.db.insert(invoiceReminders).values({ orgId, invoiceId, sentOn: day(offset).toISOString().slice(0, 10), kind: "manual" }).onConflictDoNothing();
      await this.auditLog.record(this.db, { orgId, actorUserId, action: "reminder_queued", entityType: "invoice", entityId: invoiceId, contactId: contactIds.get(contactKey)!, changes: [{ field: "emailStatus", from: "sent", to: "pending" }] });
      await backdateAudit(invoiceId, at, ["reminder_queued"]);
    };

    for (const seed of plan.invoices) {
      const create = async () => {
        const supply = await supplyFor(seed.contact, "sale");
        const invoice = await this.invoicesService.create(
          orgId,
          actorUserId,
          {
            contactId: contactIds.get(seed.contact)!,
            type: "standard",
            currency,
            ...(seed.issueInDays !== null ? { issueDate: day(seed.issueInDays) } : {}),
            dueDate: day(seed.dueInDays),
            notes: seed.notes ?? null,
            lines: lineInputs(seed.lines, supply.supplyType, seed.zeroRated),
            ...(supply.placeOfSupply ? { placeOfSupply: supply.placeOfSupply } : {}),
          } as never,
          true,
        );
        invoiceIds.set(seed.key, invoice.id);
        count("invoicesCreated");
        return invoice.id;
      };
      if (seed.outcome === "draft") {
        drafts.push(async () => void (await create()));
        continue;
      }
      at(seed.issueInDays, async () => {
        const id = await create();
        await this.invoicesService.issue(orgId, id, actorUserId);
        if (seed.issueInDays !== null) await issuedOn(id, seed.issueInDays);
        count("invoicesIssued");
        if (seed.outcome === "voided") {
          await this.invoicesService.void(orgId, id, actorUserId, seed.voidReason ?? "Voided.");
          count("invoicesVoided");
        }
      });
      for (const payment of seed.payments ?? []) at(payment.inDays, () => pay(invoiceIds.get(seed.key)!, seed.contact, payment.inDays, payment.amount, payment.method));
      if (seed.emailedInDays !== undefined) at(seed.emailedInDays, () => emailedOn(invoiceIds.get(seed.key)!, seed.contact, seed.emailedInDays ?? 0));
      if (seed.remindedInDays !== undefined) at(seed.remindedInDays, () => remindedOn(invoiceIds.get(seed.key)!, seed.contact, seed.remindedInDays ?? 0));
    }

    for (const seed of plan.jobs) {
      const job = jobRows.get(seed.key)!;
      /** Completes a milestone on its day: its completion, its photo and their history dated then. */
      const complete = async (milestoneId: string, i: number, onDay: number | null) => {
        await this.milestonesService.completeMilestone(orgId, job.id, milestoneId, actorUserId, { completionNotes: `${seed.milestones[i]!.name} — completed on schedule.`, photoFileIds: photoFor(job.index + i + 1) ? [photoFor(job.index + i + 1)!] : [] } as never);
        if (onDay === null) return;
        const done = when(onDay);
        await this.db.update(milestonesTable).set({ completedAt: done }).where(eq(milestonesTable.id, milestoneId));
        await this.db.update(jobPhotos).set({ createdAt: done }).where(eq(jobPhotos.milestoneId, milestoneId));
        await backdateAudit(milestoneId, done, ["milestone_completed"]);
      };
      seed.milestones.forEach((m, i) => {
        // US-ONB-26: completed, and waiting for the office to invoice it.
        if (m.completeInDays !== undefined && m.invoiceInDays === undefined) {
          at(m.completeInDays, async () => {
            await complete(job.milestoneIds[i]!, i, m.completeInDays ?? null);
            count("milestonesCompleted");
          });
          return;
        }
        if (m.invoiceInDays === undefined) return;
        const invoiceDay = m.invoiceInDays;
        at(invoiceDay, async () => {
          const milestoneId = job.milestoneIds[i]!;
          await complete(milestoneId, i, invoiceDay);
          const draft = await this.milestonesService.invoiceMilestone(orgId, job.id, milestoneId, actorUserId);
          // As a person would: date the milestone's invoice and give its line the job's tax before issuing.
          if (plan.ordering === "dated") {
            const supply = await supplyFor(job.contact, "sale");
            const [line] = await this.db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, draft.id));
            await this.invoicesService.update(orgId, draft.id, actorUserId, {
              ...(invoiceDay !== null ? { issueDate: day(invoiceDay) } : {}),
              ...(supply.placeOfSupply ? { placeOfSupply: supply.placeOfSupply } : {}),
              lines: seed.milestoneTax ? [{ type: "item", name: line!.name, quantity: 1, unitPriceAmount: line!.unitPriceAmount, discountPercentage: 0, taxRatePercentage: 0, isTaxInclusive: false, ...taxFor(seed.milestoneTax.tax, supply.supplyType), ...(seed.milestoneTax.hsnSac ? { hsnSac: seed.milestoneTax.hsnSac } : {}) }] : undefined,
            } as never);
          }
          await this.invoicesService.issue(orgId, draft.id, actorUserId);
          if (invoiceDay !== null) {
            await backdateAudit(milestoneId, when(invoiceDay), ["milestone_invoiced"]);
            await issuedOn(draft.id, invoiceDay);
          }
          count("milestonesInvoiced");
          if (m.paidAfterDays !== undefined) {
            const paidOn = (invoiceDay ?? 0) + m.paidAfterDays;
            at(Math.min(paidOn, 0), () => pay(draft.id, job.contact, Math.min(paidOn, 0), "full"));
          }
        });
      });
      if (seed.releaseRetention) {
        at(0, async () => {
          await this.invoicesService.releaseRetention(orgId, actorUserId, job.id);
          count("retentionReleases");
        });
      }
    }

    // Purchases. The template's categories hold the expenses.
    const categoryRows = await this.db.select({ id: expenseCategories.id, name: expenseCategories.name }).from(expenseCategories).where(eq(expenseCategories.orgId, orgId));
    const categoryId = (name: string) => categoryRows.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id;
    for (const seed of plan.bills) {
      const create = async () => {
        const supply = await supplyFor(seed.contact, "purchase");
        return this.vendorBillsService.create(
          orgId,
          actorUserId,
          {
            contactId: contactIds.get(seed.contact)!,
            jobId: seed.job ? jobRows.get(seed.job)!.id : null,
            billNumber: seed.billNumber,
            date: day(seed.dateInDays),
            dueDate: seed.dueInDays === null ? null : day(seed.dueInDays),
            currency,
            lines: lineInputs(seed.lines, supply.supplyType),
            ...(supply.placeOfSupply ? { placeOfSupply: supply.placeOfSupply } : {}),
          } as never,
          true,
        );
      };
      at(seed.dateInDays, async () => {
        const bill = await create();
        count("vendorBillsCreated");
        if (seed.outcome === "draft") return;
        const recorded = await this.vendorBillsService.record(orgId, bill.id, actorUserId);
        count("vendorBillsRecorded");
        if (seed.outcome === "voided") {
          await this.vendorBillsService.void(orgId, recorded.id, actorUserId, seed.voidReason ?? "Voided.");
          count("vendorBillsVoided");
          return;
        }
        for (const payment of seed.payments ?? []) {
          at(Math.max(payment.inDays ?? 0, seed.dateInDays), async () => {
            await this.vendorPaymentsService.create(
              orgId,
              actorUserId,
              { contactId: contactIds.get(seed.contact)!, date: payment.inDays === null ? new Date() : day(payment.inDays), method: "bank_transfer", currency, amount: recorded.totalAmount, allocations: [{ billId: recorded.id, amount: recorded.totalAmount }] } as never,
              true,
            );
            count("vendorPaymentsCreated");
          });
        }
      });
    }
    for (const seed of plan.expenses) {
      at(seed.dateInDays, async () => {
        const category = categoryId(seed.category);
        if (!category) return;
        const expense = await this.expensesService.create(
          orgId,
          actorUserId,
          {
            categoryId: category,
            jobId: seed.job ? jobRows.get(seed.job)!.id : null,
            date: day(seed.dateInDays),
            currency,
            amount: seed.amount,
            taxAmount: seed.tax?.amount ?? 0n,
            ...(seed.tax ? { taxRateId: ids(seed.tax.rate).taxRateId } : {}),
            paidBy: seed.paidBy,
            description: seed.description,
            isBillable: false,
          } as never,
          true,
        );
        count("expensesSubmitted");
        if (seed.outcome === "approved") {
          await this.expensesService.approve(orgId, expense.id, actorUserId, null);
          count("expensesApproved");
        } else if (seed.outcome === "rejected") {
          await this.expensesService.reject(orgId, expense.id, actorUserId, seed.rejectReason ?? "Rejected.");
          count("expensesRejected");
        }
      });
    }

    // Steps can add later steps (a payment after its invoice); run until none are left.
    if (plan.ordering === "dated") {
      while (steps.length) {
        steps.sort((a, b) => a.day - b.day);
        const next = steps.shift()!;
        await next.run();
      }
    } else {
      while (steps.length) await steps.shift()!.run();
    }
    for (const draft of drafts) await draft();

    // US-ONB-26: cost budgets (the newest job near what it has cost so far), % complete, and the finished job closed.
    const costs = await costByJob(this.db, [...jobRows.values()].map((j) => j.id));
    for (const seed of plan.jobs) {
      const job = jobRows.get(seed.key)!;
      const whole = (minor: bigint) => (minor / 100n) * 100n;
      const cost = costs.get(job.id) ?? 0n;
      const budget =
        seed.budget === undefined ? undefined : seed.budget === "near" ? whole(cost > 0n ? (cost * 100n) / 85n : (seed.contractValue * 6n) / 10n) : whole((seed.contractValue * BigInt(Math.round(seed.budget * 100))) / 100n);
      await this.jobsService.update(orgId, job.id, actorUserId, {
        ...(budget !== undefined ? { costBudgetAmount: budget } : {}),
        ...(seed.percentComplete !== undefined ? { percentComplete: seed.percentComplete } : {}),
        ...(seed.completed ? { status: "completed" as const } : {}),
      });
      if (seed.completed) await backdateAudit(job.id, when(seed.endInDays), ["updated"]);
    }

    // 7. A variation order on the newest job, sent and waiting for the customer.
    if (plan.variationOrder) {
      const job = jobRows.get(plan.variationOrder.job)!;
      const supply = await supplyFor(job.contact, "sale");
      const orders = await this.variationOrdersService.create(orgId, actorUserId, job.id, { currency, notes: plan.variationOrder.notes, lines: lineInputs(plan.variationOrder.lines, supply.supplyType) } as never);
      const order = orders[orders.length - 1];
      if (order) {
        // US-ONB-25: every demo quote has a title.
        await this.db.update(quotes).set({ isDemo: true, title: `Variation — ${job.name}` }).where(eq(quotes.id, order.quoteId));
        await this.quotesService.send(orgId, order.quoteId, actorUserId);
        count("variationOrdersCreated");
      }
    }

    // 8. Credit notes, issued today.
    for (const seed of plan.creditNotes) {
      const invoiceId = invoiceIds.get(seed.invoice);
      if (!invoiceId) continue;
      const lines = await this.db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).orderBy(asc(invoiceLines.sortOrder));
      const note = await this.creditNotesService.create(
        orgId,
        actorUserId,
        {
          invoiceId,
          reason: seed.reason,
          lines: seed.lines.map(({ line, quantity }) => {
            const from = lines[line]!;
            return {
              type: "item",
              catalogItemId: from.catalogItemId,
              name: from.name,
              description: from.description,
              quantity: Math.min(quantity, Number(from.quantity)),
              unitPriceAmount: from.unitPriceAmount,
              unitPriceCurrency: from.unitPriceCurrency,
              taxRatePercentage: from.taxRatePercentage,
              taxRateId: from.taxRateId,
              taxGroupId: from.taxGroupId,
              supplyClass: from.supplyClass,
              hsnSac: from.hsnSac,
            };
          }),
        } as never,
        true,
      );
      await this.creditNotesService.issue(orgId, note.id, actorUserId);
      count("creditNotesIssued");
    }

    // 9. Meetings.
    for (const seed of plan.meetings) {
      const startAt = new Date();
      startAt.setDate(startAt.getDate() + seed.startInDays);
      // US-ONB-27: at the plan's time of day.
      const [hours, minutes] = (seed.startTime ?? "09:00").split(":").map(Number);
      startAt.setHours(hours ?? 9, minutes ?? 0, 0, 0);
      const endAt = new Date(startAt);
      endAt.setHours(endAt.getHours() + seed.durationHours);
      const meeting = await this.meetingsService.create(orgId, actorUserId, { contactId: seed.contact ? contactIds.get(seed.contact)! : null, title: seed.title, startAt, endAt, location: seed.location, description: seed.description } as never);
      await this.db.update(meetingsTable).set({ isDemo: true }).where(eq(meetingsTable.id, meeting!.id));
      count("meetingsCreated");
    }

    // 11. US-MOB-04 — the demo Field person is on every demo job's crew, so
    // the field app has jobs to show. Written directly: nobody needs telling.
    const fieldUsers = await this.db
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.email, DEMO_USERS.filter((u) => u.role === "field").map((u) => u.email)));
    const crew = [...jobRows.values()].flatMap((job) => fieldUsers.map((u) => ({ jobId: job.id, userId: u.id, orgId })));
    if (crew.length) await this.db.insert(jobAssignments).values(crew);
    count("crewAssignmentsCreated", crew.length);

    return { createdTaxRateIds: created.rateIds, createdTaxGroupIds: created.groupIds, createdBundleIds, counts };
  }

  /** A business without records of its own takes the demo's identity (D-192); its own profile and registration win when set. */
  private async applySettings(orgId: string, actorUserId: string, plan: DemoPlan) {
    const ifUnset = async (key: string, value: unknown) => {
      if ((await this.settingsService.get(orgId, key)) === null) await this.settingsService.set(orgId, key, value);
    };
    if ((await this.settingsService.get(orgId, "business_profile")) === null) {
      let logoUrl: string | undefined;
      if (this.filesService.isStorageConfigured()) {
        const logo = await this.filesService.upload(orgId, { originalFilename: "logo.png", mimeType: "image/png", buffer: Buffer.from(PLACEHOLDER_PNG_BASE64, "base64"), uploadedByUserId: actorUserId });
        if (logo) logoUrl = `${process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`}/files/${logo.id}`;
      }
      const { upiId, upiPayeeName, ...profile } = plan.business;
      await this.settingsService.set(orgId, "business_profile", { ...profile, ...(logoUrl ? { logoUrl } : {}), ...(upiId ? { upiId, upiPayeeName, showUpiQr: true } : {}) });
    }
    await this.settingsService.set(orgId, "currency", plan.currency);
    await ifUnset("financial_year_start", plan.financialYearStart);

    const profile = (await this.settingsService.get<TaxProfile>(orgId, "tax_profile")) ?? {};
    if (plan.taxCountry !== "other") {
      const registration = plan.gstRegistration && !profile.registrationNumber ? plan.gstRegistration : undefined;
      await this.taxProfile.update(orgId, actorUserId, {
        country: plan.taxCountry,
        ...(registration
          ? { registrationNumber: registration.registrationNumber, legalName: registration.legalName, tradeName: registration.tradeName, stateCode: registration.stateCode, registeredOn: registration.registeredOn }
          : {}),
        ...(plan.gstRegistration && !profile.returnPeriod ? { returnPeriod: plan.gstRegistration.returnPeriod } : {}),
        ...(plan.gstRegistration && profile.exportUnderLut === undefined ? { exportUnderLut: plan.gstRegistration.exportUnderLut } : {}),
      });
    } else if (profile.country && profile.country !== "other") {
      await this.taxProfile.update(orgId, actorUserId, { country: "other" });
    }

    await this.industryTemplate.set(orgId, actorUserId, { template: plan.template });
    // Riverstone's quotes rely on the 20% discount approval threshold.
    await ifUnset("discount_approval_threshold", { percentage: 20 });
    await ifUnset("prices_include_tax", { inclusive: false });
    await ifUnset("quote_conversion_guard", { mode: "warn" });
  }

  /** The rates and groups a demo adds itself (US sales tax); the ones it made are deleted with it. */
  private async ensureOwnTaxes(orgId: string, actorUserId: string, plan: DemoPlan) {
    const rateIds: string[] = [];
    const groupIds: string[] = [];
    if (!plan.ownTaxRates.length) return { rateIds, groupIds };
    const existingRates = await this.taxRatesService.list(orgId, { includeArchived: true });
    const defaultRate = (await this.settingsService.get<{ percentage?: number }>(orgId, "default_tax_rate"))?.percentage ?? 0;
    const byName = new Map(existingRates.map((r) => [r.name, r.id]));
    for (const rate of plan.ownTaxRates) {
      if (byName.has(rate.name)) continue;
      const created = await this.taxRatesService.create(orgId, actorUserId, { name: rate.name, rate: rate.useDefaultRate && defaultRate > 0 ? defaultRate : rate.rate, isCompound: rate.isCompound ?? false } as never);
      byName.set(rate.name, created.id);
      rateIds.push(created.id);
    }
    const existingGroups = await this.taxGroupsService.list(orgId, { includeArchived: true });
    for (const group of plan.ownTaxGroups) {
      if (existingGroups.some((g) => g.name === group.name)) continue;
      const created = await this.taxGroupsService.create(orgId, actorUserId, { name: group.name, taxRateIds: group.rates.map((name) => byName.get(name)!) } as never);
      groupIds.push(created.id);
    }
    return { rateIds, groupIds };
  }

  /**
   * One real Staff and one real Field login. They're written directly — a
   * user row and a password login, hashed the way sign-in checks it —
   * because sign-up is closed once the business has an owner (US-AUTH-08)
   * and every sign-up starts an organisation of its own. Loading a demo
   * again reuses the people and moves their membership here (a person
   * whose last demo was deleted gets a new one). Their membership is demo
   * data; their logins aren't.
   */
  private async seedDemoUsers(orgId: string): Promise<number> {
    let usersCreated = 0;
    const defaultTeam = (await this.teamsService.list(orgId)).find((t) => t.isDefault);
    for (const seed of DEMO_USERS) {
      const [existingUser] = await this.db.select().from(user).where(eq(user.email, seed.email));
      let userId = existingUser?.id;
      if (!userId) {
        userId = randomUUID();
        const now = new Date();
        await this.db.insert(user).values({ id: userId, name: seed.name, email: seed.email, emailVerified: true, createdAt: now, updatedAt: now });
        await this.db.insert(account).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: await hashPassword(DEMO_USER_PASSWORD), createdAt: now, updatedAt: now });
      }
      let [moved] = await this.db.update(member).set({ organizationId: orgId, role: seed.role, isDemo: true, isPrimaryOwner: false }).where(eq(member.userId, userId)).returning();
      if (!moved) [moved] = await this.db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId, role: seed.role, createdAt: new Date(), isDemo: true, isPrimaryOwner: false }).returning();
      usersCreated++;
      // No Team grants follow the membership from wherever it was.
      await this.db.delete(teamMemberships).where(eq(teamMemberships.memberId, moved!.id));
      if (seed.joinDefaultTeam && defaultTeam) {
        const existing = await this.db.select({ id: teamMemberships.memberId }).from(teamMemberships).where(eq(teamMemberships.teamId, defaultTeam.id));
        await this.teamsService.setMembers(orgId, defaultTeam.id, [...existing.map((m) => m.id), moved!.id]);
      }
    }
    return usersCreated;
  }
}
