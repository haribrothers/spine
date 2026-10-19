import { BadRequestException, Controller, ForbiddenException, Get, Inject, Param } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { EmailDraft, EmailTemplateType } from "@spine/shared";
import { hasCapability } from "../../auth/capability.util";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { requireOrgId } from "../org/settings.controller";
import { EmailDocumentsService } from "./email-documents.service";
import { SEND_CAPABILITY } from "./send-capability";

type DocumentEmail = Exclude<EmailTemplateType, "statement">;

/** US-SET-21 — the text a "Send" dialog starts from: the template, with the document's details filled in. */
@Controller("email-drafts")
@OrgRoles(["owner", "staff"])
export class EmailDraftsController {
  constructor(
    private readonly documents: EmailDocumentsService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  @Get(":type/:id")
  async draft(@Session() session: UserSession, @Param("type") type: string, @Param("id") id: string): Promise<EmailDraft> {
    if (!(type in SEND_CAPABILITY) || type === "statement") throw new BadRequestException("Choose an email to draft.");
    const orgId = requireOrgId(session);
    if (!(await hasCapability(this.db, { orgId, userId: session.user.id }, SEND_CAPABILITY[type as DocumentEmail]))) {
      throw new ForbiddenException("You don't have permission to send this email.");
    }
    return this.documents.draft(orgId, type as DocumentEmail, id);
  }
}
