import { BadRequestException, Controller, Get, Query, StreamableFile } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { RequireCapability } from "../../../auth/require-capability.decorator";
import { requireOrgId } from "../../org/settings.controller";
import { Gstr1Service } from "./gstr1.service";

const FORMATS = ["summary", "json", "xlsx"];

/**
 * US-TAX-16 (D-148) — `GET /exports/gstr1?period=YYYY-MM|YYYY-Qn&format=`:
 * `summary` for the page, `json` for the GST portal's offline tool, `xlsx`
 * to check it first (US-TAX-17). Read
 * like the Tax Summary: Owner, or "View financial statements".
 */
@Controller("exports")
export class Gstr1Controller {
  constructor(private readonly gstr1: Gstr1Service) {}

  @Get("gstr1")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("reports.view_financial_statements")
  async gstr1File(@Session() session: UserSession, @Query("period") period: string, @Query("format") format = "summary") {
    const orgId = requireOrgId(session);
    if (!FORMATS.includes(format)) throw new BadRequestException("Choose JSON or Excel.");
    if (format === "summary") return this.gstr1.summary(orgId, period);
    if (format === "xlsx") {
      const book = await this.gstr1.xlsx(orgId, session.user.id, period);
      return new StreamableFile(book.body, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", disposition: `attachment; filename="${book.filename}"` });
    }
    const file = await this.gstr1.json(orgId, session.user.id, period);
    return new StreamableFile(Buffer.from(file.body, "utf8"), { type: "application/json; charset=utf-8", disposition: `attachment; filename="${file.filename}"` });
  }
}
