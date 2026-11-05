import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { DEMO_COUNTRIES, DEMO_INDUSTRIES, buildDemoPlan, type DemoCountry, type DemoIndustry } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { member, organization, user } from "../../db/schema";
import { seedChartOfAccounts } from "../../db/seed/chart-of-accounts";
import { seedDefaultTeam } from "../../db/seed/default-team";
import { seedLeadStages } from "../../db/seed/lead-stages";
import { DEMO_AWAITING_OWNER_KEY, type DemoAwaitingOwner } from "../../auth/signup-policy";
import { SettingsService } from "../org/settings.service";
import { DemoDataService } from "./demo-data.service";

export const DEMO_LOADED_MESSAGE = "Demo data loaded — the first person to sign up becomes its owner.";
export const DEMO_SKIPPED_MESSAGE = "Demo seeding skipped — the database already has data, so SEED_DEMO only loads into an empty one.";

export type SeedDemoChoice = { country?: DemoCountry; industry?: DemoIndustry };

/**
 * `SEED_DEMO`: unset or `false` is off; `true` is the default demo (United
 * States, Construction / Contracting); `<country>:<industry>` picks one, as
 * `IN:interior_design` (D-192). Anything else is `"invalid"`.
 */
export function parseSeedDemo(value: string | undefined): SeedDemoChoice | null | "invalid" {
  const v = value?.trim() ?? "";
  if (v === "" || v.toLowerCase() === "false") return null;
  if (v.toLowerCase() === "true") return {};
  const [country, industry, ...rest] = v.split(":");
  const c = country?.toUpperCase() as DemoCountry;
  const i = industry?.toLowerCase() as DemoIndustry;
  if (rest.length || !DEMO_COUNTRIES.includes(c) || !DEMO_INDUSTRIES.includes(i)) return "invalid";
  return { country: c, industry: i };
}

/**
 * US-OPS-02 (D-086) — `SEED_DEMO` loads the demo business on first start,
 * into an empty database only, with no owner account: the first person to
 * sign up becomes its Primary Owner (`claimDemoBusiness`), with onboarding
 * marked skipped. The demo is loaded as a placeholder Owner with no
 * password, whose membership the claim replaces; audit history names it.
 * A failure is logged, never fatal: Spine still starts, and the first
 * sign-up still owns the (empty) business and goes through onboarding.
 */
@Injectable()
export class DemoBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger("Demo data");

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly demoData: DemoDataService,
    private readonly settings: SettingsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.run(process.env.SEED_DEMO).catch((error: unknown) => {
      this.logger.error(`SEED_DEMO couldn't load the demo business, so Spine started without it: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  async run(value: string | undefined): Promise<"off" | "invalid" | "skipped" | "loaded"> {
    const choice = parseSeedDemo(value);
    if (choice === null) return "off";
    if (choice === "invalid") {
      this.logger.warn(`SEED_DEMO=${value} isn't true, false or a country and an industry (e.g. IN:interior_design), so no demo data was loaded.`);
      return "invalid";
    }
    const [anyUser] = await this.db.select({ id: user.id }).from(user).limit(1);
    const [anyOrg] = await this.db.select({ id: organization.id }).from(organization).limit(1);
    if (anyUser || anyOrg) {
      this.logger.log(DEMO_SKIPPED_MESSAGE);
      return "skipped";
    }

    const plan = buildDemoPlan(choice.country ?? "US", choice.industry ?? "construction");
    const now = new Date();
    const placeholderUserId = randomUUID();
    const orgId = randomUUID();
    // No credential account: nobody can sign in as it.
    await this.db.insert(user).values({ id: placeholderUserId, name: "Spine demo", email: `demo-owner-${placeholderUserId}@spine.invalid`, emailVerified: false, createdAt: now, updatedAt: now });
    await this.db.insert(organization).values({ id: orgId, name: plan.business.name, slug: `org-${randomUUID()}`, createdAt: now });
    await this.db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: placeholderUserId, role: "owner", isDemo: true, isPrimaryOwner: false, createdAt: now });
    // As a sign-up's business (auth.ts): accounts, the default Team and the pipeline.
    await seedChartOfAccounts(this.db, orgId);
    await seedDefaultTeam(this.db, orgId);
    await seedLeadStages(this.db, orgId);

    // Claimable before the demo loads: if loading fails, the first sign-up still gets a working business, and onboarding.
    await this.settings.set(orgId, DEMO_AWAITING_OWNER_KEY, { placeholderUserId } satisfies DemoAwaitingOwner);
    await this.demoData.seed(orgId, placeholderUserId, choice);
    await this.settings.set(orgId, "onboarding_status", { completedSteps: [], skipped: true });
    this.logger.log(DEMO_LOADED_MESSAGE);
    return "loaded";
  }
}
