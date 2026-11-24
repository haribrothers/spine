import { Controller, Get, Inject, Query } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { member } from "../../db/schema";
import { requireOrgId } from "../org/settings.controller";
import { ActivityFeedService } from "./activity-feed.service";

/**
 * S-09.14 (dashboard v2) — org-wide activity feed. Session-gated only, not
 * `@OrgRoles`/`@RequireCapability` — every role reaches this route, and
 * the service itself does the role-based filtering internally (Field's
 * feed excludes financial event types entirely), matching the
 * `DASHBOARD_WIDGETS` registry's own "activity-feed: capability: null,
 * role-filtered server-side" entry.
 */
@Controller("dashboard")
export class ActivityFeedController {
  constructor(
    private readonly activityFeedService: ActivityFeedService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  @Get("activity-feed")
  async activityFeed(@Session() session: UserSession, @Query("limit") limit?: string) {
    const orgId = requireOrgId(session);
    const [membership] = await this.db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, session.user.id)));
    // US-DASH-19: the full feed page asks for more rows (up to 100).
    const n = Math.min(Math.max(Number(limit) || 30, 1), 100);
    return this.activityFeedService.list(orgId, membership?.role ?? null, session.user.id, n);
  }
}
