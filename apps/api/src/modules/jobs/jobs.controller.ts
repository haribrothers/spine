import { Body, Controller, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createJobSchema, updateJobSchema, setMilestonesSchema, completeMilestoneSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { JobsService } from "./jobs.service";
import { MilestonesService } from "./milestones.service";
import { InvoicesService } from "../invoices/invoices.service";

/**
 * PRD F4 — jobs and their milestones. GET routes are readable by any
 * authenticated org member (owner/staff/field all have legitimate reasons
 * to look at a job — field crews need to see what they're billing
 * against). Mutating routes on the job/milestone-definition surface use
 * `invoices.manage` (closest existing capability — job/milestone creation
 * is billing-adjacent, same "office staff" tier as raising an invoice,
 * per §2.1's persona table). `jobs.update_milestones` is reserved for
 * S-04.4's own field-reachable "mark complete" action (MilestonesController,
 * added in Stage 2), not this controller's job/milestone-definition CRUD.
 */
@Controller("jobs")
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly milestonesService: MilestonesService,
    private readonly invoicesService: InvoicesService,
  ) {}

  @Get()
  async list(@Session() session: UserSession, @Query("status") status?: string, @Query("contactId") contactId?: string) {
    const orgId = requireOrgId(session);
    return this.jobsService.list(orgId, { status, contactId });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.jobsService.getOne(orgId, id);
  }

  @Post()
  @OrgRoles(["owner", "staff"])
  @RequireCapability("invoices.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createJobSchema.parse(body);
    return this.jobsService.create(orgId, session.user.id, input);
  }

  /** S-04.1 / S-03.10's job half — creates a job from an accepted quote's own snapshot. */
  @Post("from-quote/:quoteId")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("invoices.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async createFromQuote(
    @Session() session: UserSession,
    @Param("quoteId") quoteId: string,
    @Body() body: { retentionPct?: number },
  ) {
    const orgId = requireOrgId(session);
    return this.jobsService.createFromQuote(orgId, session.user.id, quoteId, body?.retentionPct ?? 0);
  }

  @Put(":id")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("invoices.manage")
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateJobSchema.parse(body);
    return this.jobsService.update(orgId, id, session.user.id, input);
  }

  @Get(":id/milestones")
  async listMilestones(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.milestonesService.list(orgId, id);
  }

  /** S-04.2/S-04.3 — replaces the job's entire milestone set with server-side percentage-total validation. */
  @Put(":id/milestones")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("invoices.manage")
  async setMilestones(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = setMilestonesSchema.parse(body);
    return this.milestonesService.setAll(orgId, id, session.user.id, input);
  }

  /**
   * S-04.4 — mark a milestone complete with photos. Field-reachable (per
   * §2.1's "Upload site photos, update milestone status: Field ✅"), so
   * this uses `@OrgRoles(["owner", "staff", "field"])` +
   * `jobs.update_milestones` rather than the `invoices.manage` gate the
   * rest of this controller uses — a field crew member has no business
   * creating jobs or raising invoices, but marking their own work done is
   * exactly what this capability exists for.
   */
  @Post(":id/milestones/:milestoneId/complete")
  @OrgRoles(["owner", "staff", "field"])
  @RequireCapability("jobs.update_milestones")
  @UseInterceptors(IdempotencyInterceptor)
  async completeMilestone(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Param("milestoneId") milestoneId: string,
    @Body() body: unknown,
  ) {
    const orgId = requireOrgId(session);
    const input = completeMilestoneSchema.parse(body);
    return this.milestonesService.completeMilestone(orgId, id, milestoneId, session.user.id, input);
  }

  /** S-04.5 / S-05.1's milestone path — raises a progress invoice directly from a completed milestone. Office-staff action, same gate as job/milestone creation. */
  @Post(":id/milestones/:milestoneId/invoice")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("invoices.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async invoiceMilestone(@Session() session: UserSession, @Param("id") id: string, @Param("milestoneId") milestoneId: string) {
    const orgId = requireOrgId(session);
    return this.milestonesService.invoiceMilestone(orgId, id, milestoneId, session.user.id);
  }

  /** S-04.7 — releases a job's outstanding retention as a final invoice. */
  @Post(":id/release-retention")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("invoices.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async releaseRetention(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.invoicesService.releaseRetention(orgId, session.user.id, id);
  }
}
