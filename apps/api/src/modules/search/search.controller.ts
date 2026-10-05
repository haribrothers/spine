import { Controller, Get, Query } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { requireOrgId } from "../org/settings.controller";
import { SearchService } from "./search.service";

/** US-OPS-22 — `GET /search?q=&limit=5`, any member; each group follows its module's read rules. */
@Controller("search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  async find(@Session() session: UserSession, @Query("q") q = "", @Query("limit") limit?: string) {
    return this.search.search(requireOrgId(session), session.user.id, q, limit ? Number(limit) || 5 : 5);
  }
}
