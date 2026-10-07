import { BadRequestException, Body, Controller, Inject, Param, Post, ServiceUnavailableException, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { emailTemplatesSchema, emailTemplateTypeSchema, type EmailTemplateText, type EmailTemplateType } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { loadEmailBrand } from "../email/email-brand";
import { appUrl, EMAIL_LOGO_CID, renderEmail } from "../email/email-layout";
import { EmailService } from "../email/email.service";
import { requireOrgId } from "../org/settings.controller";
import { EmailDocumentsService, type BuiltEmail } from "./email-documents.service";

/** Where a quote's link would go, for a preview or test (the real one is made when the quote is sent). */
const EXAMPLE_LINK = () => appUrl("/quote/example");

export const EMAIL_NOT_SET_UP = "Email isn't set up yet, so a test can't be sent. Ask an Owner to set up email.";

/**
 * US-SET-22 — Settings › Emails' "Preview" and "Send me a test", for the text
 * on screen (saved or not): the email in the branded layout, made from a
 * recent real document, or sample details when there's none. Owner-only,
 * like changing the templates.
 */
@Controller("org/settings/email_templates")
@OrgRoles(["owner"])
export class EmailTemplatePreviewController {
  constructor(
    private readonly documents: EmailDocumentsService,
    private readonly email: EmailService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  @Post(":type/preview")
  async preview(@Session() session: UserSession, @Param("type") type: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const { kind, text } = this.parse(type, body);
    const built = await this.build(orgId, kind, text);
    const rendered = renderEmail(await loadEmailBrand(this.db, orgId), built.template.content);
    // The logo is attached to real emails; here it's inlined so the browser can show it.
    const logo = rendered.attachments.find((a) => a.cid === EMAIL_LOGO_CID);
    const html = logo ? rendered.html.replaceAll(`cid:${EMAIL_LOGO_CID}`, `data:${logo.contentType};base64,${Buffer.from(logo.content as Buffer).toString("base64")}`) : rendered.html;
    return { subject: built.template.subject, html, source: built.source };
  }

  @Post(":type/test")
  @UseInterceptors(IdempotencyInterceptor)
  async test(@Session() session: UserSession, @Param("type") type: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const { kind, text } = this.parse(type, body);
    if (!this.email.isConfigured()) throw new ServiceUnavailableException(EMAIL_NOT_SET_UP);
    const brand = await loadEmailBrand(this.db, orgId);
    const built = await this.build(orgId, kind, text);
    const rendered = renderEmail(brand, built.template.content);
    // Only to the person who asked — never the customer on the document it was made from.
    await this.email.send({ to: session.user.email, fromName: brand.name, subject: `[Test] ${built.template.subject}`, text: rendered.text, html: rendered.html, attachments: rendered.attachments });
    return { sentTo: session.user.email };
  }

  private parse(type: string, body: unknown): { kind: EmailTemplateType; text: EmailTemplateText } {
    const kind = emailTemplateTypeSchema.safeParse(type);
    if (!kind.success) throw new BadRequestException("Choose an email to preview.");
    const parsed = emailTemplatesSchema.safeParse({ [kind.data]: body });
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the email text and try again.");
    return { kind: kind.data, text: parsed.data[kind.data]! };
  }

  /** A recent real document of this kind, else sample details; statements always use sample details. */
  private async build(orgId: string, kind: EmailTemplateType, text: EmailTemplateText): Promise<BuiltEmail> {
    if (kind !== "statement") {
      const id = await this.documents.latestId(orgId, kind);
      if (id) return this.documents.build(orgId, kind, id, text, EXAMPLE_LINK());
    }
    return this.documents.sample(await loadEmailBrand(this.db, orgId), kind, text, EXAMPLE_LINK());
  }
}
