import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { jobs, invoices } from "../../db/schema";
import { SettingsService } from "./settings.service";

const SETTING_KEY = "quote_conversion_guard";

export type QuoteConversionGuardMode = "off" | "warn" | "block";

const DEFAULT_MODE: QuoteConversionGuardMode = "warn";

interface ExistingConversions {
  jobs: { id: string; name: string }[];
  invoices: { id: string; number: string | null }[];
}

/**
 * Org preference (per-org setting, not hardcoded) governing what happens
 * when a user converts the SAME accepted quote into a job or invoice more
 * than once. Nothing in the schema stops this — `JobsService.createFromQuote`
 * and `InvoicesService.convertFromQuote` both independently snapshot the
 * quote's total with no "already converted" check, per their own long-
 * standing doc comments explaining why (a second, deliberate conversion is
 * a real use case: staged billing, splitting one quote across two
 * trackable jobs). The risk this guards against is the ACCIDENTAL case —
 * re-clicking "Convert to job"/"Convert to invoice" on a quote that was
 * already converted, which silently doubles the money on the books with
 * no total anywhere cross-checking against the original quote.
 *
 * Both call sites share this ONE service (not duplicated per-module) so
 * the mode/behaviour can never drift between the job and invoice
 * conversion paths — same principle as LedgerService being the one place
 * that posts journal entries.
 *
 * `check()` is called BEFORE the conversion happens:
 *  - `mode: "off"` — always returns silently, whether or not prior
 *    conversions exist (matches the pre-existing, pre-guard behaviour).
 *  - `mode: "block"` — throws BadRequestException (400) if ANY job or
 *    invoice already traces back to this quote. No override exists from
 *    the UI; an Owner has to lower this org setting first.
 *  - `mode: "warn"` (the default) — if prior conversions exist AND the
 *    caller has not passed `confirm: true`, throws ConflictException
 *    (409) with a structured body `{ existing: ExistingConversions }` so
 *    the web UI can render a real dialog listing what already exists,
 *    then retry the exact same request with `confirm: true`. If the
 *    caller already passed `confirm: true`, or nothing prior exists,
 *    this returns silently either way.
 */
@Injectable()
export class QuoteConversionGuardService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
  ) {}

  async check(orgId: string, quoteId: string, confirm: boolean): Promise<void> {
    const setting = await this.settings.get<{ mode: QuoteConversionGuardMode }>(orgId, SETTING_KEY);
    const mode = setting?.mode ?? DEFAULT_MODE;
    if (mode === "off") return;

    const existing = await this.findExisting(orgId, quoteId);
    const hasExisting = existing.jobs.length > 0 || existing.invoices.length > 0;
    if (!hasExisting) return;

    if (mode === "block") {
      throw new BadRequestException(
        `This quote already has ${describeExisting(existing)}. Converting it again is blocked by this organisation's quote conversion setting.`,
      );
    }

    // mode === "warn"
    if (confirm) return;
    throw new ConflictException({
      message: `This quote already has ${describeExisting(existing)}. Convert it again anyway?`,
      existing,
    });
  }

  private async findExisting(orgId: string, quoteId: string): Promise<ExistingConversions> {
    const [existingJobs, existingInvoices] = await Promise.all([
      this.db
        .select({ id: jobs.id, name: jobs.name })
        .from(jobs)
        .where(and(eq(jobs.orgId, orgId), eq(jobs.sourceQuoteId, quoteId))),
      this.db
        .select({ id: invoices.id, number: invoices.number })
        .from(invoices)
        .where(and(eq(invoices.orgId, orgId), eq(invoices.sourceQuoteId, quoteId))),
    ]);
    return { jobs: existingJobs, invoices: existingInvoices };
  }
}

function describeExisting(existing: ExistingConversions): string {
  const parts: string[] = [];
  if (existing.jobs.length) {
    parts.push(`${existing.jobs.length} job${existing.jobs.length > 1 ? "s" : ""} (${existing.jobs.map((j) => j.name).join(", ")})`);
  }
  if (existing.invoices.length) {
    parts.push(
      `${existing.invoices.length} invoice${existing.invoices.length > 1 ? "s" : ""} (${existing.invoices.map((i) => i.number ?? "draft").join(", ")})`,
    );
  }
  return parts.join(" and ");
}
