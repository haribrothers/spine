import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { REPORTS, digestEnabledFor, type DashboardLayout, type DigestDays, type NotificationPreferences } from "@spine/shared";
import { and, eq } from "drizzle-orm";
import { auth } from "../../auth/auth";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { member, user } from "../../db/schema";

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
}

/**
 * S-10.17 — self-service Profile & Preferences, deliberately outside
 * OrgModule/TeamsModule: this is user-identity-scoped, not org-scoped, and
 * must work regardless of role (Owner/Staff/Field alike) — never gate
 * anything here with @OrgRoles.
 */
@Injectable()
export class UsersService {
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
    return {
      ...row,
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
    input: { name?: string; email?: string; image?: string | null },
  ): Promise<ProfileRow> {
    if (input.name !== undefined || input.image !== undefined) {
      await auth.api.updateUser({ headers, body: { name: input.name, image: input.image } });
    }
    if (input.email !== undefined) {
      await auth.api.changeEmail({ headers, body: { newEmail: input.email } });
    }
    return this.getMe(userId, null);
  }

  async changePassword(headers: Headers, currentPassword: string, newPassword: string): Promise<void> {
    await auth.api.changePassword({ headers, body: { currentPassword, newPassword, revokeOtherSessions: false } });
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
