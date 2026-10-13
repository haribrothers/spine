import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { REPORTS, deviceName, digestEnabledFor, type AccountSession, type DashboardLayout, type DigestDays, type NotificationPreferences } from "@spine/shared";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { auth } from "../../auth/auth";
import { verifyPassword } from "../../auth/password";
import { orgLocale } from "../../common/money-format";
import { orgTimeZone } from "../../common/org-clock";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { account, member, session as sessionTable, settings, user } from "../../db/schema";
import { loadEmailBrand } from "../email/email-brand";
import { renderEmail } from "../email/email-layout";
import { EmailService } from "../email/email.service";
import { emailChangedEmail } from "../email/email-templates";

/** The meeting reminder Spine uses when neither the person nor the business chose one (meeting-reminder.worker). */
const DEFAULT_MEETING_REMINDER_MINUTES = 15;

export interface ProfileRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  themePreference: string;
  meetingReminderLeadMinutes: number | null;
  /** US-NTF-14 — the daily digest, resolved against the role default (D-093). */
  digestEnabled: boolean;
  digestTime: string;
  digestDays: DigestDays;
  /** US-AUTH-19 — the business's defaults, named where the person's own choice falls back to them. */
  orgDefaults: { meetingReminderLeadMinutes: number; timeZone: string };
}

/**
 * S-10.17 — self-service Profile & Preferences, deliberately outside
 * OrgModule/TeamsModule: this is user-identity-scoped, not org-scoped, and
 * must work regardless of role (Owner/Staff/Field alike) — never gate
 * anything here with @OrgRoles.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async getMe(userId: string, orgId?: string | null): Promise<ProfileRow> {
    const [row] = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        themePreference: user.themePreference,
        meetingReminderLeadMinutes: user.meetingReminderLeadMinutes,
        digestEnabled: user.digestEnabled,
        digestTime: user.digestTime,
        digestDays: user.digestDays,
      })
      .from(user)
      .where(eq(user.id, userId));
    if (!row) {
      throw new BadRequestException("User not found");
    }
    const [membership] = orgId
      ? await this.db.select({ role: member.role }).from(member).where(and(eq(member.userId, userId), eq(member.organizationId, orgId)))
      : [];
    const [reminder] = orgId
      ? await this.db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "meeting_reminder_lead_minutes")))
      : [];
    const orgMinutes = (reminder?.value as { minutes?: number } | undefined)?.minutes;
    return {
      ...row,
      orgDefaults: { meetingReminderLeadMinutes: typeof orgMinutes === "number" ? orgMinutes : DEFAULT_MEETING_REMINDER_MINUTES, timeZone: orgTimeZone() },
      digestEnabled: digestEnabledFor(membership?.role, row.digestEnabled),
      digestTime: row.digestTime.slice(0, 5),
      digestDays: row.digestDays === "daily" ? "daily" : "weekdays",
    };
  }

  /** US-NTF-14 — turn the daily digest on or off and choose its time and days (self only). */
  async setNotificationPreferences(userId: string, orgId: string | null, input: NotificationPreferences): Promise<ProfileRow> {
    await this.db.update(user).set({ digestEnabled: input.digestEnabled, digestTime: input.digestTime, digestDays: input.digestDays }).where(eq(user.id, userId));
    return this.getMe(userId, orgId);
  }

  /**
   * Delegates name/image to Better Auth's own updateUser and email changes
   * to changeEmail, rather than raw Drizzle writes, so any future
   * verification/hook behavior Better Auth adds stays correct automatically.
   * This instance has no emailVerification callback configured (see
   * CLAUDE.md's permission-model note), so changeEmail applies immediately
   * — there is no re-verification step to wait on today.
   */
  async updateProfile(
    userId: string,
    headers: Headers,
    input: { name?: string; image?: string | null },
  ): Promise<ProfileRow> {
    if (input.name !== undefined || input.image !== undefined) {
      await auth.api.updateUser({ headers, body: { name: input.name, image: input.image } });
    }
    return this.getMe(userId, null);
  }

  /**
   * US-AUTH-17 — other sessions end unless the person unticks it. Ended here,
   * not with Better Auth's `revokeOtherSessions` (which also replaces this
   * session with one whose cookie this route can't hand back).
   */
  async changePassword(headers: Headers, currentPassword: string, newPassword: string, signOutOthers: { userId: string; currentSessionId: string | null } | null): Promise<void> {
    await auth.api.changePassword({ headers, body: { currentPassword, newPassword, revokeOtherSessions: false } });
    if (signOutOthers) await this.endOtherSessions(signOutOthers.userId, signOutOthers.currentSessionId);
  }

  /**
   * US-AUTH-18 (D-236) — a new sign-in email needs the current password, and
   * the old address is told (who to contact if it wasn't them). An email
   * outage never fails the change.
   */
  async changeEmail(
    userId: string,
    orgId: string | null,
    input: { newEmail: string; currentPassword: string },
    from: { userAgent: string | null; ip: string | null },
  ): Promise<ProfileRow> {
    const [me] = await this.db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, userId));
    if (!me) throw new NotFoundException("User not found");
    const [credential] = await this.db.select({ password: account.password }).from(account).where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
    if (!credential?.password || !(await verifyPassword({ password: input.currentPassword, hash: credential.password }))) {
      throw new BadRequestException({ statusCode: 400, message: "That password isn't right.", error: "WRONG_PASSWORD", field: "currentPassword" });
    }
    if (input.newEmail === me.email.toLowerCase()) throw new BadRequestException({ statusCode: 400, message: "That's already your sign-in email.", error: "SAME_EMAIL", field: "newEmail" });
    const [taken] = await this.db.select({ id: user.id }).from(user).where(and(sql`lower(${user.email}) = ${input.newEmail}`, ne(user.id, userId)));
    if (taken) throw new ConflictException({ statusCode: 409, message: "Another account uses that email.", error: "EMAIL_TAKEN", field: "newEmail" });
    // Written here: Better Auth's own changeEmail is off (no verification emails), and the password is checked above.
    await this.db.update(user).set({ email: input.newEmail, emailVerified: false, updatedAt: new Date() }).where(eq(user.id, userId));
    await this.sendEmailChanged(orgId, userId, me, input.newEmail, from);
    return this.getMe(userId, orgId);
  }

  private async sendEmailChanged(orgId: string | null, userId: string, me: { name: string; email: string }, newEmail: string, from: { userAgent: string | null; ip: string | null }) {
    if (!orgId) return;
    try {
      const brand = await loadEmailBrand(this.db, orgId);
      const owners = await this.db.select({ name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(and(eq(member.organizationId, orgId), eq(member.role, "owner"), ne(member.userId, userId)));
      const when = new Intl.DateTimeFormat(await orgLocale(this.db, orgId), { dateStyle: "medium", timeStyle: "short", timeZone: orgTimeZone() }).format(new Date());
      const device = [deviceName(from.userAgent), from.ip].filter(Boolean).join(" · ");
      const template = emailChangedEmail({ name: me.name, businessName: brand.name, newEmail, when, device, ownerNames: owners.map((o) => o.name).join(", ") });
      const emailService = new EmailService(this.db);
      const log = { orgId, kind: "email_changed" as const, userId };
      if (!emailService.isConfigured()) {
        await emailService.recordNotSent(log, me.email, template.subject);
        return;
      }
      const email = renderEmail(brand, template.content);
      await emailService.send({ to: me.email, fromName: brand.name, subject: template.subject, text: email.text, html: email.html, attachments: email.attachments, log });
    } catch (err) {
      this.logger.error("Email-changed notice failed to send", err instanceof Error ? err.message : String(err));
    }
  }

  /** US-AUTH-17 — where this account is signed in, most recently active first. */
  async listSessions(userId: string, currentSessionId: string | null): Promise<AccountSession[]> {
    const rows = await this.db
      .select({ id: sessionTable.id, userAgent: sessionTable.userAgent, ipAddress: sessionTable.ipAddress, updatedAt: sessionTable.updatedAt, createdAt: sessionTable.createdAt, expiresAt: sessionTable.expiresAt })
      .from(sessionTable)
      .where(eq(sessionTable.userId, userId))
      .orderBy(desc(sessionTable.updatedAt));
    const now = Date.now();
    return rows
      .filter((r) => r.expiresAt.getTime() > now)
      .map((r) => ({ id: r.id, device: deviceName(r.userAgent), ipAddress: r.ipAddress, lastActiveAt: r.updatedAt.toISOString(), createdAt: r.createdAt.toISOString(), current: r.id === currentSessionId }))
      .sort((a, b) => Number(b.current) - Number(a.current));
  }

  /** US-AUTH-17 — ends one of this person's other sessions (web or phone). */
  async endSession(userId: string, sessionId: string, currentSessionId: string | null): Promise<void> {
    if (sessionId === currentSessionId) throw new BadRequestException("Use Sign out for this device.");
    const deleted = await this.db.delete(sessionTable).where(and(eq(sessionTable.id, sessionId), eq(sessionTable.userId, userId))).returning({ id: sessionTable.id });
    if (!deleted.length) throw new NotFoundException("That session has already ended.");
  }

  /** US-AUTH-17 — ends every session but this one. */
  async endOtherSessions(userId: string, currentSessionId: string | null): Promise<{ signedOut: number }> {
    const where = currentSessionId ? and(eq(sessionTable.userId, userId), ne(sessionTable.id, currentSessionId)) : eq(sessionTable.userId, userId);
    const deleted = await this.db.delete(sessionTable).where(where).returning({ id: sessionTable.id });
    return { signedOut: deleted.length };
  }

  async updatePreferences(userId: string, themePreference: string): Promise<ProfileRow> {
    await this.db.update(user).set({ themePreference }).where(eq(user.id, userId));
    return this.getMe(userId, null);
  }

  /**
   * S-09.13 — trivial read/write by id, same "no @OrgRoles, any
   * authenticated user edits their own row" reasoning as every other
   * method here. `null` (unset) means "use the registry default order,
   * nothing hidden" — `DashboardShell`'s own layout-merge logic owns that
   * fallback, not this service.
   */
  async getDashboardLayout(userId: string): Promise<DashboardLayout | null> {
    const [row] = await this.db.select({ dashboardLayout: user.dashboardLayout }).from(user).where(eq(user.id, userId));
    return (row?.dashboardLayout as DashboardLayout | null) ?? null;
  }

  async setDashboardLayout(userId: string, layout: DashboardLayout): Promise<void> {
    await this.db.update(user).set({ dashboardLayout: layout }).where(eq(user.id, userId));
  }

  /** US-DASH-26 — the member's dashboard profit basis; accrual until they choose cash. */
  async getDashboardBasis(userId: string): Promise<"accrual" | "cash"> {
    const [row] = await this.db.select({ basis: user.dashboardBasis }).from(user).where(eq(user.id, userId));
    return row?.basis === "cash" ? "cash" : "accrual";
  }

  async setDashboardBasis(userId: string, basis: "accrual" | "cash"): Promise<void> {
    await this.db.update(user).set({ dashboardBasis: basis }).where(eq(user.id, userId));
  }

  /** US-RPT-23 — the reports this member starred, in the order they starred them. Unknown slugs are dropped. */
  async getFavouriteReports(userId: string): Promise<string[]> {
    const [row] = await this.db.select({ favourites: user.favouriteReports }).from(user).where(eq(user.id, userId));
    const known = new Set(REPORTS.map((r) => r.slug));
    return ((row?.favourites as string[] | null) ?? []).filter((s) => known.has(s));
  }

  async setFavouriteReports(userId: string, slugs: string[]): Promise<string[]> {
    const known = new Set(REPORTS.map((r) => r.slug));
    const clean = [...new Set(slugs)].filter((s) => known.has(s));
    await this.db.update(user).set({ favouriteReports: clean }).where(eq(user.id, userId));
    return clean;
  }

  /**
   * S-10.22 — personal override of the org's default meeting-reminder lead
   * time. `null` explicitly clears the override back to "use the org
   * default" — same "no @OrgRoles, any authenticated user edits their own
   * row" reasoning as every other method here.
   */
  async setMeetingReminderLeadMinutes(userId: string, minutes: number | null): Promise<ProfileRow> {
    await this.db.update(user).set({ meetingReminderLeadMinutes: minutes }).where(eq(user.id, userId));
    return this.getMe(userId, null);
  }
}
