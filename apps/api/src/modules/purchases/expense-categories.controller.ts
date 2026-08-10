import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createExpenseCategorySchema, updateExpenseCategorySchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { ExpenseCategoriesService } from "./expense-categories.service";

/** GET routes open to any authenticated member (Field needs to pick a category when submitting an expense) — mutation gated on `purchases.manage`, matching CatalogController's own any-can-read/owner+staff-can-write split. */
@Controller("expense-categories")
export class ExpenseCategoriesController {
  constructor(private readonly expenseCategoriesService: ExpenseCategoriesService) {}

  @Get()
  async list(@Session() session: UserSession, @Query("includeArchived") includeArchived?: string) {
    const orgId = requireOrgId(session);
    return this.expenseCategoriesService.list(orgId, { includeArchived: includeArchived === "true" });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.expenseCategoriesService.getOne(orgId, id);
  }

  @Post()
  @OrgRoles(["owner", "staff"])
  @RequireCapability("purchases.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createExpenseCategorySchema.parse(body);
    return this.expenseCategoriesService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("purchases.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateExpenseCategorySchema.parse(body);
    return this.expenseCategoriesService.update(orgId, id, session.user.id, input);
  }

  @Post(":id/archive")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("purchases.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async archive(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.expenseCategoriesService.archive(orgId, id, session.user.id);
  }

  @Post(":id/restore")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("purchases.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async restore(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.expenseCategoriesService.restore(orgId, id, session.user.id);
  }

  @Delete(":id")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("purchases.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.expenseCategoriesService.delete(orgId, id, session.user.id);
  }
}
