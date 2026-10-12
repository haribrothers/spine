import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, Logger } from "@nestjs/common";
import { PASSWORD_TOO_COMMON_MESSAGE, SAME_AS_GIVEN_PASSWORD_MESSAGE, passwordProblem } from "@spine/shared";
import { and, desc, eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../../auth/password";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { account, auditLog, member, session as sessionTable, user } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { loadEmailBrand } from "../email/email-brand";
import { appUrl, renderEmail } from "../email/email-layout";
import { EmailService } from "../email/email.service";
import { passwordSetByOwnerEmail } from "../email/email-templates";

/** Who set this person's password and when, for "Priya Raman set a password for you on 12 Oct". */
export interface PasswordSetBy {
  name: string | null;
  at: Date;
}

/**
 * US-TEAM-24 (D-233) — an Owner sets a Staff or Field member's password;
 * the member then chooses their own before anything else works. Nobody's
 * Owner password is ever set this way — the Primary Owner's above all —
 * and the password is never logged or emailed.
 */
@Injectable()
export class MemberPasswordService {
  private readonly logger = new Logger(MemberPasswordService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditLogService,
  ) {}

  /** The 8-character minimum and the common list, as at sign-up (US-AUTH-15). */
  private checkStrength(password: string) {
    const problem = passwordProblem(password);
    if (problem) throw new BadRequestException({ statusCode: 400, message: problem, error: problem === PASSWORD_TOO_COMMON_MESSAGE ? "PASSWORD_TOO_COMMON" : "Bad Request" });
  }

  /** Writes the credential password, adding the credential login if the person never had one. */
  private async writePassword(tx: Pick<Database, "select" | "update" | "insert">, userId: string, hash: string) {
    const updated = await tx
      .update(account)
      .set({ password: hash, updatedAt: new Date() })
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
      .returning({ id: account.id });
    if (updated.length === 0) {
      const now = new Date();
      await tx.insert(account).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: hash, createdAt: now, updatedAt: now });
    }
  }

  async setPassword(orgId: string, memberId: string, newPassword: string, actorUserId: string): Promise<void> {
    const [target] = await this.db
      .select({ userId: member.userId, role: member.role, isActive: member.isActive, name: user.name, email: user.email })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(and(eq(member.organizationId, orgId), eq(member.id, memberId)));
    if (!target) throw new BadRequestException("Member not found");
    // Ownership before status (07-security): whose password it is decides first.
    if (target.userId === actorUserId) throw new BadRequestException("Change your own password from Profile.");
    if (target.role !== "staff" && target.role !== "field") throw new ForbiddenException(`Only ${target.name} can change their own password.`);
    if (!target.isActive) throw new BadRequestException("Reactivate them before setting their password.");
    this.checkStrength(newPassword);

    const hash = await hashPassword(newPassword);
    await this.db.transaction(async (tx) => {
      await this.writePassword(tx, target.userId, hash);
      await tx.update(user).set({ mustChangePassword: true, updatedAt: new Date() }).where(eq(user.id, target.userId));
      // Signed out everywhere, web and phone.
      await tx.delete(sessionTable).where(eq(sessionTable.userId, target.userId));
      await this.audit.record(tx, {
        orgId,
        actorUserId,
        action: "password_set",
        entityType: "user",
        entityId: target.userId,
        contactId: null,
        changes: [{ field: "password", from: "", to: "Set by an owner — they choose their own at next sign-in" }],
      });
    });
    await this.sendNotice(orgId, actorUserId, target);
  }

  /** Emails the person that an Owner changed their password — never the password. An outage never fails the change. */
  private async sendNotice(orgId: string, actorUserId: string, target: { userId: string; name: string; email: string }) {
    try {
      const [owner] = await this.db.select({ name: user.name }).from(user).where(eq(user.id, actorUserId));
      const brand = await loadEmailBrand(this.db, orgId);
      const template = passwordSetByOwnerEmail({ name: target.name, ownerName: owner?.name ?? "An owner", businessName: brand.name, signInUrl: appUrl("/login") });
      const emailService = new EmailService(this.db);
      const log = { orgId, kind: "password_set_by_owner" as const, userId: actorUserId };
      if (!emailService.isConfigured()) {
        await emailService.recordNotSent(log, target.email, template.subject);
        return;
      }
      const email = renderEmail(brand, template.content);
      await emailService.send({ to: target.email, fromName: brand.name, subject: template.subject, text: email.text, html: email.html, attachments: email.attachments, log });
    } catch (err) {
      this.logger.error("Password-changed notice failed to send", err instanceof Error ? err.message : String(err));
    }
  }

  /** Who last set this person's password and when (from the audit log). */
  async passwordSetBy(orgId: string, userId: string): Promise<PasswordSetBy | null> {
    const [row] = await this.db
      .select({ name: user.name, at: auditLog.createdAt })
      .from(auditLog)
      .leftJoin(user, eq(user.id, auditLog.actorUserId))
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "user"), eq(auditLog.entityId, userId), eq(auditLog.action, "password_set")))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    return row ? { name: row.name, at: row.at } : null;
  }

  /**
   * The person's own choice after an Owner set it: no current password —
   * this session already proved it. It can't be the one they were given.
   * Their other sessions end; this one carries on.
   */
  async choosePassword(userId: string, sessionToken: string | undefined, newPassword: string): Promise<void> {
    const [row] = await this.db.select({ must: user.mustChangePassword }).from(user).where(eq(user.id, userId));
    if (!row?.must) throw new BadRequestException("Change your password from Profile.");
    this.checkStrength(newPassword);
    const [current] = await this.db
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
    if (current?.password && (await verifyPassword({ password: newPassword, hash: current.password }))) {
      throw new BadRequestException({ statusCode: 400, message: SAME_AS_GIVEN_PASSWORD_MESSAGE, error: "SAME_AS_GIVEN_PASSWORD" });
    }
    const hash = await hashPassword(newPassword);
    await this.db.transaction(async (tx) => {
      await this.writePassword(tx, userId, hash);
      await tx.update(user).set({ mustChangePassword: false, updatedAt: new Date() }).where(eq(user.id, userId));
      const sessions = await tx.select({ id: sessionTable.id, token: sessionTable.token }).from(sessionTable).where(eq(sessionTable.userId, userId));
      for (const s of sessions) if (s.token !== sessionToken) await tx.delete(sessionTable).where(eq(sessionTable.id, s.id));
    });
  }
}
