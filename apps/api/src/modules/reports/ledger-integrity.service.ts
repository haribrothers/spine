import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { formatMoney } from "@spine/shared";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";
import { ledgerIntegrityChecks, organization, settings } from "../../db/schema";
import { NotificationsService } from "../notifications/notifications.service";
import { orgLocale } from "../../common/money-format";
import { QueueService } from "../queue/queue.service";

export const LEDGER_INTEGRITY_QUEUE = "ledger-integrity-check";
/** Daily at 02:00 server time. */
const DAILY_CRON = "0 2 * * *";

export interface LedgerIntegrityStatus {
  balanced: boolean;
  checkedAt: Date | null;
  /** The Owners' warning, or null when the books balance (or haven't been checked yet). */
  message: string | null;
}

/** US-RPT-12 — the Owners' warning, with the difference in the organisation's currency. */
export function outOfBalanceMessage(difference: bigint, currency: string, locale = "en-US"): string {
  const amount = difference < 0n ? -difference : difference;
  return `Your books are out of balance by ${formatMoney(amount, currency, locale)}. Contact the person who runs Spine.`;
}

/**
 * US-RPT-12 — a daily check that every organisation's ledger balances. The
 * database trigger already refuses an unbalanced journal entry, so this
 * guards against data repair mistakes made outside the app. When the books
 * are out, Owners get an in-app notification (`ledger_out_of_balance`) and
 * a dashboard warning until a later check finds them balanced again.
 */
@Injectable()
export class LedgerIntegrityService implements OnModuleInit {
  private readonly logger = new Logger(LedgerIntegrityService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly queue: QueueService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.queue.schedule(LEDGER_INTEGRITY_QUEUE, DAILY_CRON);
    await this.queue.work(LEDGER_INTEGRITY_QUEUE, async () => {
      await this.runAll();
    });
  }

  async runAll(now = new Date()): Promise<void> {
    const orgs = await this.db.select({ id: organization.id }).from(organization);
    for (const { id } of orgs) await this.check(id, now);
  }

  /** Checks one organisation and records the result; returns the difference (debits − credits). */
  async check(orgId: string, now = new Date()): Promise<bigint> {
    const [row] = await this.db.execute<{ difference: string }>(sql`
      select coalesce(sum(jl.debit - jl.credit), 0)::text as difference
      from journal_lines jl
      join journal_entries je on je.id = jl.entry_id
      where je.org_id = ${orgId}
    `);
    const difference = BigInt(row?.difference ?? "0");
    const [previous] = await this.db.select().from(ledgerIntegrityChecks).where(eq(ledgerIntegrityChecks.orgId, orgId));
    const lastBalancedAt = difference === 0n ? now : (previous?.lastBalancedAt ?? null);

    await this.db
      .insert(ledgerIntegrityChecks)
      .values({ orgId, checkedAt: now, difference, lastBalancedAt })
      .onConflictDoUpdate({ target: ledgerIntegrityChecks.orgId, set: { checkedAt: now, difference, lastBalancedAt } });

    if (difference !== 0n) {
      this.logger.error(
        `Ledger out of balance for organisation ${orgId}: debits − credits = ${difference} (minor units). Last good check: ${lastBalancedAt?.toISOString() ?? "never"}.`,
      );
      const message = outOfBalanceMessage(difference, await this.currency(orgId), await orgLocale(this.db, orgId));
      await this.notifications.notify(orgId, {
        recipientRoles: ["owner"],
        subject: "Your books are out of balance",
        text: message,
        inApp: { type: "ledger_out_of_balance", message, link: "/dashboard" },
      });
    }
    return difference;
  }

  async status(orgId: string): Promise<LedgerIntegrityStatus> {
    const [row] = await this.db.select().from(ledgerIntegrityChecks).where(eq(ledgerIntegrityChecks.orgId, orgId));
    if (!row) return { balanced: true, checkedAt: null, message: null };
    if (row.difference === 0n) return { balanced: true, checkedAt: row.checkedAt, message: null };
    return { balanced: false, checkedAt: row.checkedAt, message: outOfBalanceMessage(row.difference, await this.currency(orgId), await orgLocale(this.db, orgId)) };
  }

  private async currency(orgId: string): Promise<string> {
    const [row] = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(sql`${settings.orgId} = ${orgId} and ${settings.key} = 'currency'`);
    return (row?.value as { code?: string } | undefined)?.code ?? process.env.CURRENCY ?? "USD";
  }
}
