import { BadRequestException, Controller, ForbiddenException, Get, Inject, Param } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { Capability, EmailDraft, EmailTemplateType } from "@spine/shared";
import { hasCapability } from "../../auth/capability.util";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { requireOrgId } from "../org/settings.controller";
import { EmailDocumentsService } from "./email-documents.service";

type DocumentEmail = Exclude<EmailTemplateType, "statement">;

/** Who may send each email (and so see its draft). */
const SEND_CAPABILITY: Record<DocumentEmail, Capability> = {
  quote: "quotes.send",
  invoice: "invoices.send",
  reminder: "invoices.send_reminder",
  receipt: "payments.send_receipt",
  credit_note: "invoices.send",
};

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
    if (!(type in SEND_CAPABILITY)) throw new BadRequestException("Choose an email to draft.");
    const orgId = requireOrgId(session);
    if (!(await hasCapability(this.db, { orgId, userId: session.user.id }, SEND_CAPABILITY[type as DocumentEmail]))) {
      throw new ForbiddenException("You don't have permission to send this email.");
    }
    return this.documents.draft(orgId, type as DocumentEmail, id);
  }
}
