import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Post, Query, UseInterceptors } from "@nestjs/common";
import { parseSearchTypes, recordRecentSchema, type RecordRecentInput } from "@spine/shared";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { requireOrgId } from "../org/settings.controller";
import { SearchService } from "./search.service";

/**
 * US-OPS-22 — `GET /search?q=&limit=5`, any member; each group follows its module's read rules.
 * US-OPS-46, US-OPS-49 — `includeArchived=true`, and `types=` to narrow to an area (up to 20 a group).
 * US-OPS-39 — the caller's own recent records and searches.
 */
@Controller("search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  async find(
    @Session() session: UserSession,
    @Query("q") q = "",
    @Query("limit") limit?: string,
    @Query("types") types?: string,
    @Query("includeArchived") includeArchived?: string,
  ) {
    const groups = parseSearchTypes(types);
    if (groups === null) throw new BadRequestException("Choose what to search.");
    return this.search.search(requireOrgId(session), session.user.id, q, {
      limit: limit ? Number(limit) || undefined : undefined,
      types: groups,
      includeArchived: includeArchived === "true",
    });
  }

  @Get("recent")
  async recent(@Session() session: UserSession) {
    return this.search.recent(requireOrgId(session), session.user.id);
  }

  @Post("recent")
  @HttpCode(204)
  @UseInterceptors(IdempotencyInterceptor)
  async record(@Session() session: UserSession, @Body(new ZodValidationPipe(recordRecentSchema)) body: RecordRecentInput) {
    requireOrgId(session);
    await this.search.recordRecent(session.user.id, body);
  }

  @Delete("recent")
  @HttpCode(204)
  @UseInterceptors(IdempotencyInterceptor)
  async clear(@Session() session: UserSession) {
    requireOrgId(session);
    await this.search.clearRecent(session.user.id);
  }
}
