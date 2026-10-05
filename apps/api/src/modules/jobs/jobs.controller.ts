import { JobAccessService, historyWithoutMoney, withoutMoney } from "./job-access.service";
import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { ApiBody } from "@nestjs/swagger";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  createJobSchema,
  updateJobSchema,
  setMilestonesSchema,
  completeMilestoneSchema,
  addJobPhotoSchema,
  addJobNoteSchema,
  createVariationOrderSchema,
  assignJobSchema,
} from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { JobsService } from "./jobs.service";
import { MilestonesService } from "./milestones.service";
import { InvoicesService } from "../invoices/invoices.service";
import { VariationOrdersService } from "./variation-orders.service";
import { JobCostingService } from "./job-costing.service";
import { AddJobNoteDto, AddJobPhotoDto, AssignJobDto, CompleteMilestoneDto } from "./jobs.dto";

/**
 * PRD F4 — jobs and their milestones. GET routes are readable by any
 * authenticated org member (owner/staff/field all have legitimate reasons
 * to look at a job — field crews need to see what they're billing
 * against). Mutating routes use the own/others capability split (PRD §2.1,
 * §9 Phase 3): `jobs.edit_own`/`jobs.edit_others` gate job create/update;
 * `milestones.edit_own`/`milestones.edit_others` gate the milestone-set
 * definition route, with Field always passing both (see
 * `FIELD_ALWAYS_CAPABILITIES`'s doc comment — milestone completion was
 * never meant to be an ownership question for Field); `job_photos.*`/
 * `job_notes.*`/`variation_orders.*` follow the same own/others shape.
 * Dedicated workflow-action capabilities (`milestones.invoice`,
 * `jobs.release_retention`, `variation_orders.apply`) gate actions that
 * aren't edits. Ownership checks that depend on the loaded record
 * (`update`, `setMilestones`, `completeMilestone`, `addPhoto`, `addNote`,
 * `createVariationOrder`) are enforced in the service layer via
 * `requireOwnershipCapability`, not `@RequireCapability` here — same
 * pattern as every other own/others module in this codebase.
 */
@Controller("jobs")
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly milestonesService: MilestonesService,
    private readonly invoicesService: InvoicesService,
    private readonly variationOrdersService: VariationOrdersService,
    private readonly jobCostingService: JobCostingService,
    private readonly jobAccess: JobAccessService,
  ) {}

  /** `assignedToMe` (Phase 5 mobile home screen, S-11.2) mirrors `GET /expenses?mine=true`'s own precedent — narrows to jobs the requesting user is assigned to via `job_assignments`. */
  @Get()
  async list(
    @Session() session: UserSession,
    @Query("status") status?: string,
    @Query("contactId") contactId?: string,
    @Query("assignedToMe") assignedToMe?: string,
    @Query("include") include?: string,
  ) {
    const orgId = requireOrgId(session);
    const { field } = await this.jobAccess.check(orgId, session.user.id);
    // US-JOB-19: Field always gets only their assigned jobs, without money.
    const rows = await this.jobsService.list(orgId, {
      status,
      contactId,
      assignedToUserId: field || assignedToMe === "true" ? session.user.id : undefined,
    });
    if (field) return rows.map(withoutMoney);
    // US-JOB-25: budget used per job, only for members who may see job profitability.
    return include === "costing" ? this.jobCostingService.withCosting(orgId, session.user.id, rows) : rows;
  }

  /**
   * S-09.12 (dashboard v2) — "job milestones due" widget, across every
   * job. Declared BEFORE `:id` below — Nest matches routes in declaration
   * order, so a literal segment like `milestones/due` must come first or
   * it's swallowed by `:id` (id="milestones") instead.
   */
  @Get("milestones/due")
  @OrgRoles(["owner", "staff", "field"])
  async milestonesDue(@Session() session: UserSession, @Query("withinDays") withinDays?: string) {
    const orgId = requireOrgId(session);
    const { field } = await this.jobAccess.check(orgId, session.user.id);
    return this.milestonesService.dueAcrossJobs(orgId, {
      withinDays: withinDays ? Number(withinDays) : undefined,
      assignedToUserId: field ? session.user.id : undefined,
    });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    const { field } = await this.jobAccess.check(orgId, session.user.id, id);
    const job = await this.jobsService.getOne(orgId, id);
    return field ? withoutMoney(job) : job;
  }

  /** `GET /jobs/:id/history` — a real read against AuditLogService.record()'s existing writes (`entityType: "job"`), same pattern as InvoicesController.getHistory. No `@RequireCapability` — a read, matching every other GET in this controller. */
  @Get(":id/history")
  async getHistory(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    const { field } = await this.jobAccess.check(orgId, session.user.id, id);
    const history = await this.jobsService.getHistory(orgId, id);
    return field ? historyWithoutMoney(history) : history;
  }

  @Post()
  @OrgRoles(["owner", "staff"])
  @RequireCapability("jobs.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createJobSchema.parse(body);
    return this.jobsService.create(orgId, session.user.id, input);
  }

  /**
   * S-04.1 / S-03.10's job half — creates a job from an accepted quote's
   * own snapshot. `confirm` (optional) mirrors
   * InvoicesController.convertFromQuote's own doc comment — only
   * meaningful when the org's `quote_conversion_guard` setting is "warn".
   */
  @Post("from-quote/:quoteId")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("jobs.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async createFromQuote(
    @Session() session: UserSession,
    @Param("quoteId") quoteId: string,
    @Body() body: { retentionPct?: number; confirm?: boolean },
  ) {
    const orgId = requireOrgId(session);
    return this.jobsService.createFromQuote(orgId, session.user.id, quoteId, body?.retentionPct ?? 0, body?.confirm === true);
  }

  @Put(":id")
  @UseInterceptors(IdempotencyInterceptor)
  @OrgRoles(["owner", "staff"])
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const parsed = updateJobSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the job and try again.");
    return this.jobsService.update(orgId, id, session.user.id, parsed.data);
  }

  /** Phase 5 (Mobile) — who's on a job's crew. Read is unconditional, same as every other GET on this controller. */
  @Get(":id/assignees")
  async listAssignees(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    await this.jobAccess.check(orgId, session.user.id, id);
    return this.jobsService.listAssignees(orgId, id);
  }

  /** Dedicated `jobs.assign` workflow-action capability, checked in the service (not `@RequireCapability` here) since it isn't own/others-shaped but still follows this codebase's "capability check lives with the mutation" convention for actions gated purely by role, not record ownership. */
  @Post(":id/assignees")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  @ApiBody({ type: AssignJobDto })
  async assign(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = assignJobSchema.parse(body);
    return this.jobsService.assign(orgId, id, session.user.id, input);
  }

  @Delete(":id/assignees/:userId")
  @UseInterceptors(IdempotencyInterceptor)
  @OrgRoles(["owner", "staff"])
  async unassign(@Session() session: UserSession, @Param("id") id: string, @Param("userId") userId: string) {
    const orgId = requireOrgId(session);
    return this.jobsService.unassign(orgId, id, session.user.id, userId);
  }

  @Get(":id/milestones")
  async listMilestones(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    const { field } = await this.jobAccess.check(orgId, session.user.id, id);
    const rows = await this.milestonesService.list(orgId, id);
    return field ? rows.map(withoutMoney) : rows;
  }

  /** S-04.2/S-04.3 — replaces the job's entire milestone set with server-side percentage-total validation. Ownership check happens in the service, since "own" here means whoever last replaced the set (see MilestonesService.setAll's own doc comment). */
  @Put(":id/milestones")
  @UseInterceptors(IdempotencyInterceptor)
  @OrgRoles(["owner", "staff"])
  async setMilestones(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = setMilestonesSchema.parse(body);
    return this.milestonesService.setAll(orgId, id, session.user.id, input);
  }

  /**
   * S-04.4 — mark a milestone complete with photos. Field-reachable (per
   * §2.1's "Upload site photos, update milestone status: Field ✅") — Field
   * always passes both `milestones.edit_own` and `milestones.edit_others`
   * (see `FIELD_ALWAYS_CAPABILITIES`), so this was never meant to be an
   * ownership question for Field. Capability check happens in the service.
   */
  /** `GET /jobs/:id/milestones/:milestoneId/history` — mirrors JobsController.getHistory but scoped to one milestone (`entityType: "milestone"`), delegated to MilestonesService since milestones are its own sub-resource. */
  @Get(":id/milestones/:milestoneId/history")
  async getMilestoneHistory(@Session() session: UserSession, @Param("id") id: string, @Param("milestoneId") milestoneId: string) {
    const orgId = requireOrgId(session);
    const { field } = await this.jobAccess.check(orgId, session.user.id, id);
    const history = await this.milestonesService.getHistory(orgId, id, milestoneId);
    return field ? historyWithoutMoney(history) : history;
  }

  @Post(":id/milestones/:milestoneId/complete")
  @OrgRoles(["owner", "staff", "field"])
  @UseInterceptors(IdempotencyInterceptor)
  @ApiBody({ type: CompleteMilestoneDto })
  async completeMilestone(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Param("milestoneId") milestoneId: string,
    @Body() body: unknown,
  ) {
    const orgId = requireOrgId(session);
    const { field } = await this.jobAccess.check(orgId, session.user.id, id);
    const input = completeMilestoneSchema.parse(body);
    const completed = await this.milestonesService.completeMilestone(orgId, id, milestoneId, session.user.id, input);
    return field ? withoutMoney(completed) : completed;
  }

  /** S-04.5 / S-05.1's milestone path — raises a progress invoice directly from a completed milestone. Dedicated workflow-action capability, not an edit. */
  @Post(":id/milestones/:milestoneId/invoice")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("milestones.invoice")
  @UseInterceptors(IdempotencyInterceptor)
  async invoiceMilestone(@Session() session: UserSession, @Param("id") id: string, @Param("milestoneId") milestoneId: string) {
    const orgId = requireOrgId(session);
    return this.milestonesService.invoiceMilestone(orgId, id, milestoneId, session.user.id);
  }

  /** S-04.7 — releases a job's outstanding retention as a final invoice. Dedicated workflow-action capability, not an edit. */
  @Post(":id/release-retention")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("jobs.release_retention")
  @UseInterceptors(IdempotencyInterceptor)
  async releaseRetention(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.invoicesService.releaseRetention(orgId, session.user.id, id);
  }

  /** S-04.8 (revenue side) — cost/revenue/margin for a job, read live off journal_lines. Job profitability is financial reporting: it needs `reports.view_job_profitability`, which Field never has (US-JOB-19, D-072). */
  @Get(":id/costing")
  // CapabilityGuard lets Field through by design (it relies on @OrgRoles to
  // exclude them), so Field is excluded here explicitly.
  @OrgRoles(["owner", "staff"])
  @RequireCapability("reports.view_job_profitability")
  async costing(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.jobCostingService.report(orgId, id);
  }

  @Get(":id/photos")
  async listPhotos(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    await this.jobAccess.check(orgId, session.user.id, id);
    return this.jobsService.listPhotos(orgId, id);
  }

  /** S-04.10 (web upload) — attach an already-uploaded file (`POST /files`) as a general job/site photo. Field-reachable; `job_photos.edit_own` gates create, ownership check happens in the service. */
  @Post(":id/photos")
  @OrgRoles(["owner", "staff", "field"])
  @RequireCapability("job_photos.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  @ApiBody({ type: AddJobPhotoDto })
  async addPhoto(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    await this.jobAccess.check(orgId, session.user.id, id);
    const input = addJobPhotoSchema.parse(body);
    return this.jobsService.addPhoto(orgId, id, session.user.id, input);
  }

  /** `GET /jobs/:id/photos/:photoId/history` — mirrors the milestones history route above, scoped to a single job photo (`entityType: "job_photo"`). Create-only resource, so this shows a single "created" row. */
  @Get(":id/photos/:photoId/history")
  async getPhotoHistory(@Session() session: UserSession, @Param("id") id: string, @Param("photoId") photoId: string) {
    const orgId = requireOrgId(session);
    await this.jobAccess.check(orgId, session.user.id, id);
    return this.jobsService.getPhotoHistory(orgId, id, photoId);
  }

  @Get(":id/notes")
  async listNotes(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    await this.jobAccess.check(orgId, session.user.id, id);
    return this.jobsService.listNotes(orgId, id);
  }

  /** Field-reachable, same shape as addPhoto above. */
  @Post(":id/notes")
  @UseInterceptors(IdempotencyInterceptor)
  @OrgRoles(["owner", "staff", "field"])
  @RequireCapability("job_notes.edit_own")
  @ApiBody({ type: AddJobNoteDto })
  async addNote(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    await this.jobAccess.check(orgId, session.user.id, id);
    const input = addJobNoteSchema.parse(body);
    return this.jobsService.addNote(orgId, id, session.user.id, input);
  }

  /** `GET /jobs/:id/notes/:noteId/history` — mirrors getPhotoHistory above, scoped to a single job note (`entityType: "job_note"`). */
  @Get(":id/notes/:noteId/history")
  async getNoteHistory(@Session() session: UserSession, @Param("id") id: string, @Param("noteId") noteId: string) {
    const orgId = requireOrgId(session);
    await this.jobAccess.check(orgId, session.user.id, id);
    return this.jobsService.getNoteHistory(orgId, id, noteId);
  }

  /** S-04.9 — variation orders raised against this job. */
  @Get(":id/variation-orders")
  async listVariationOrders(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    await this.jobAccess.check(orgId, session.user.id, id);
    return this.variationOrdersService.list(orgId, id);
  }

  @Post(":id/variation-orders")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("variation_orders.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async createVariationOrder(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createVariationOrderSchema.parse(body);
    return this.variationOrdersService.create(orgId, session.user.id, id, input);
  }

  /** Folds an accepted variation order's total into the job's contract value — see VariationOrdersService.apply's own doc comment on why this is a deliberate, explicit action rather than automatic on quote acceptance. Dedicated workflow-action capability, not an edit. */
  @Post(":id/variation-orders/:variationOrderId/apply")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("variation_orders.apply")
  @UseInterceptors(IdempotencyInterceptor)
  async applyVariationOrder(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Param("variationOrderId") variationOrderId: string,
  ) {
    const orgId = requireOrgId(session);
    return this.variationOrdersService.apply(orgId, session.user.id, id, variationOrderId);
  }
}
