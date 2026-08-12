import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { DashboardLayout } from "@spine/shared";
import { eq } from "drizzle-orm";
import { auth } from "../../auth/auth";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { user } from "../../db/schema";

export interface ProfileRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  themePreference: string;
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

  async getMe(userId: string): Promise<ProfileRow> {
    const [row] = await this.db
      .select({ id: user.id, name: user.name, email: user.email, image: user.image, themePreference: user.themePreference })
      .from(user)
      .where(eq(user.id, userId));
    if (!row) {
      throw new BadRequestException("User not found");
    }
    return row;
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
    return this.getMe(userId);
  }

  async changePassword(headers: Headers, currentPassword: string, newPassword: string): Promise<void> {
    await auth.api.changePassword({ headers, body: { currentPassword, newPassword, revokeOtherSessions: false } });
  }

  async updatePreferences(userId: string, themePreference: string): Promise<ProfileRow> {
    await this.db.update(user).set({ themePreference }).where(eq(user.id, userId));
    return this.getMe(userId);
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
}
