export interface MemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "staff" | "field" | string;
  isActive: boolean;
  isPrimaryOwner: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  /** US-TEAM-19 — only on an Owner's list. */
  teams?: { id: string; name: string }[];
  lastActiveAt?: string | null;
  isDemo?: boolean;
  /** US-TEAM-24 — only on `/org/members/me`: an Owner set their password, and who did it when. */
  mustChangePassword?: boolean;
  organizationName?: string;
  passwordSetBy?: { name: string | null; at: string } | null;
}
