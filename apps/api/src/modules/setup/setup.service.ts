import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, isNotNull, isNull, ne } from "drizzle-orm";
import { INDUSTRY_TEMPLATES, SETUP_CARD_KEYS, isOn, resolveModules, setupProgress, type ModuleSettings, type SetupCardKey, type SetupStatus, type TaxProfile } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts, catalogItems, invitation, invoices, member, moneyAccounts, numberSequences, openingBalances, quotes, settings } from "../../db/schema";
import { DEFAULT_CHART_OF_ACCOUNTS } from "../../db/seed/chart-of-accounts";
import { EmailService } from "../email/email.service";
import { NUMBERING_DEFAULTS, type NumberingDocumentType } from "../numbering/numbering.service";

/** `settings.setup_hidden` — the cards an Owner marked "not needed" (US-ONB-15). */
export const SETUP_HIDDEN_KEY = "setup_hidden";

/** The names the chart and the templates give accounts, by code: an account that isn't one of these, or was renamed, is the owner's own. */
const SEEDED_ACCOUNT_NAMES = new Map<string, string>([
  ...DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.code, a.name] as const),
  ...Object.values(INDUSTRY_TEMPLATES).flatMap((t) => t.accounts.map((a) => [a.code, a.name] as const)),
]);

/**
 * US-ONB-15 (D-155, D-194) — what's set up and what's left. Each card is
 * worked out from the business's own data, never ticked by hand, so it
 * turns "Done" the moment the thing is done. A loaded demo counts as it
 * stands (the page says so); Backups can't be checked until Phase 12 and
 * is `done: null`; Field app only applies while Jobs & field is on.
 */
@Injectable()
export class SetupService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly email: EmailService,
  ) {}

  async status(orgId: string): Promise<SetupStatus> {
    const rows = await this.db.select({ key: settings.key, value: settings.value }).from(settings).where(eq(settings.orgId, orgId));
    const setting = <T>(key: string) => rows.find((r) => r.key === key)?.value as T | undefined;
    const modules: ModuleSettings = resolveModules(setting<Partial<ModuleSettings>>("modules"));
    const hidden = new Set(setting<string[]>(SETUP_HIDDEN_KEY) ?? []);

    const done = await this.checks(orgId, setting);
    const keys = SETUP_CARD_KEYS.filter((key) => key !== "field_app" || isOn(modules, "jobsField"));
    return {
      cards: keys.map((key) => ({ key, done: done[key], hidden: hidden.has(key) })),
      demoLoaded: await this.demoLoaded(orgId, Boolean(setting("demo_data"))),
    };
  }

  /** Cards still to do (the dashboard's "Finish setting up Spine — <n> left"). */
  async left(orgId: string): Promise<number> {
    return setupProgress((await this.status(orgId)).cards).toDo;
  }

  async setHidden(orgId: string, key: string, hide: boolean): Promise<SetupStatus> {
    if (!(SETUP_CARD_KEYS as readonly string[]).includes(key)) throw new BadRequestException("There's no setup card with that name.");
    const [row] = await this.db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, SETUP_HIDDEN_KEY)));
    const current = new Set((row?.value as string[] | undefined) ?? []);
    if (hide) current.add(key);
    else current.delete(key);
    const value = SETUP_CARD_KEYS.filter((k) => current.has(k));
    await this.db
      .insert(settings)
      .values({ orgId, key: SETUP_HIDDEN_KEY, value })
      .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value, updatedAt: new Date() } });
    return this.status(orgId);
  }

  private async demoLoaded(orgId: string, recorded: boolean): Promise<boolean> {
    if (recorded) return true;
    const [item] = await this.db.select({ id: catalogItems.id }).from(catalogItems).where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.isDemo, true))).limit(1);
    const [quote] = await this.db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.isDemo, true))).limit(1);
    const [invoice] = await this.db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.isDemo, true))).limit(1);
    return Boolean(item || quote || invoice);
  }

  private async checks(orgId: string, setting: <T>(key: string) => T | undefined): Promise<Record<SetupCardKey, boolean | null>> {
    const profile = setting<{ name?: string; address?: string; paymentInstructions?: string; upiId?: string }>("business_profile") ?? {};
    const tax = setting<TaxProfile>("tax_profile") ?? {};
    const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;
    const hasValues = (v: unknown) => Boolean(v) && typeof v === "object" && Object.keys(v as object).length > 0;

    const [orgAccounts, money, opening, sequences, others, invites, fieldPeople] = await Promise.all([
      this.db.select({ code: accounts.code, name: accounts.name }).from(accounts).where(eq(accounts.orgId, orgId)),
      this.db
        .select({ code: accounts.code, name: moneyAccounts.name, bankName: moneyAccounts.bankName, last4: moneyAccounts.last4 })
        .from(moneyAccounts)
        .innerJoin(accounts, eq(accounts.id, moneyAccounts.accountId))
        .where(and(eq(moneyAccounts.orgId, orgId), isNull(moneyAccounts.archivedAt))),
      this.db.select({ id: openingBalances.orgId }).from(openingBalances).where(and(eq(openingBalances.orgId, orgId), isNotNull(openingBalances.lockedAt))).limit(1),
      this.db.select({ type: numberSequences.documentType, prefix: numberSequences.prefix, padding: numberSequences.padding, next: numberSequences.nextValue }).from(numberSequences).where(and(eq(numberSequences.orgId, orgId), eq(numberSequences.isDemo, false))),
      this.db.select({ id: member.id }).from(member).where(and(eq(member.organizationId, orgId), eq(member.isDemo, false), eq(member.isActive, true), ne(member.role, "owner"))).limit(1),
      this.db.select({ id: invitation.id }).from(invitation).where(and(eq(invitation.organizationId, orgId), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date()))).limit(1),
      this.db.select({ id: member.id }).from(member).where(and(eq(member.organizationId, orgId), eq(member.isDemo, false), eq(member.isActive, true), eq(member.role, "field"))).limit(1),
    ]);

    return {
      business: filled(profile.name) && filled(profile.address),
      // India needs the GST registration too (US-TAX-12).
      tax: Boolean(tax.country) && (tax.country !== "IN" || (filled(tax.registrationNumber) && filled(tax.stateCode))),
      // An account added, or one the chart or a template made then renamed.
      accounts: orgAccounts.some((a) => SEEDED_ACCOUNT_NAMES.get(a.code) !== a.name),
      opening_balances: opening.length > 0,
      // D-155: a money account beyond the two seeded ones, or the seeded bank account given its details.
      bank_accounts: money.some((m) => (m.code !== "1000" && m.code !== "1010") || (m.code === "1010" && (m.name !== SEEDED_ACCOUNT_NAMES.get("1010") || filled(m.bankName) || filled(m.last4)))),
      payment_instructions: filled(profile.paymentInstructions) || filled(profile.upiId),
      documents: hasValues(setting("document_layout")) || hasValues(setting("email_templates")),
      // Numbers set up in Settings, or already in use.
      numbering: sequences.some((s) => s.next > 1 || s.prefix !== NUMBERING_DEFAULTS[s.type as NumberingDocumentType]?.prefix || s.padding !== NUMBERING_DEFAULTS[s.type as NumberingDocumentType]?.padding),
      reminders: setting<{ enabled?: boolean }>("invoice_reminders")?.enabled === true,
      modules: setting("modules") !== undefined,
      team: others.length > 0 || invites.length > 0,
      email: this.email.isConfigured(),
      // D-194: nothing to check until backups exist (US-OPS-03, Phase 12).
      backups: null,
      field_app: fieldPeople.length > 0,
    };
  }
}
