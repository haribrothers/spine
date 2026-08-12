import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { ActivityFeedController } from "./activity-feed.controller";
import { ActivityFeedService } from "./activity-feed.service";

/**
 * PRD S-12.9's setup checklist (`DashboardController`/`DashboardService`)
 * plus, added for S-09.14 (dashboard v2), the org-wide activity feed
 * (`ActivityFeedController`/`ActivityFeedService`) — both mounted at
 * `@Controller("dashboard")` on distinct sub-paths (`/dashboard/checklist`,
 * `/dashboard/activity-feed`), no route collision. Kept out of
 * `ReportsModule` since neither the checklist nor the activity feed is a
 * financial report and neither should inherit `ReportsController`'s
 * class-level `@OrgRoles(["owner","staff"])` gate — every role, including
 * Field, reaches both (the activity feed role-filters internally rather
 * than route-gating).
 */
@Module({
  controllers: [DashboardController, ActivityFeedController],
  providers: [DashboardService, ActivityFeedService],
})
export class DashboardModule {}
