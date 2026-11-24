import { BadRequestException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import {
  emailOverrideSchema,
  resolveEmailTemplate,
  unknownPlaceholder,
  unknownPlaceholderMessage,
  type EmailOverride,
  type EmailTemplates,
  type EmailTemplateText,
  type EmailTemplateType,
} from "@spine/shared";
import type { Database } from "../../db/client";
import { settings } from "../../db/schema";

export const EMAIL_TEMPLATES_KEY = "email_templates";

/** What a queued email carries from its "Send" dialog (US-SET-21): nothing means the template as saved. */
export type EmailJobOverride = EmailOverride;

/** The organisation's saved email templates (only the ones someone changed). */
export async function loadEmailTemplates(db: Database, orgId: string): Promise<EmailTemplates> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, EMAIL_TEMPLATES_KEY)));
  return (row?.value ?? {}) as EmailTemplates;
}

/**
 * US-SET-21 (D-153) — the words an email goes out with: what was typed in
 * its "Send" dialog, else the saved template, else Spine's default.
 */
export async function loadEmailText(db: Database, orgId: string, type: EmailTemplateType, override?: EmailJobOverride | null): Promise<EmailTemplateText> {
  const base = resolveEmailTemplate(await loadEmailTemplates(db, orgId), type);
  return { subject: override?.subject ?? base.subject, body: override?.message ?? base.body };
}

/** Parses a "Send" dialog's changes for this email, refusing a placeholder it can't fill. */
export function parseEmailOverride(type: EmailTemplateType, body: unknown): EmailJobOverride {
  const parsed = emailOverrideSchema.safeParse(body ?? {});
  if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the email and try again.");
  for (const text of [parsed.data.subject, parsed.data.message]) {
    const name = text ? unknownPlaceholder(text, type) : null;
    if (name !== null) throw new BadRequestException(unknownPlaceholderMessage(name));
  }
  return parsed.data;
}
