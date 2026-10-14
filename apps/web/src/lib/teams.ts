export interface TeamSummary {
  id: string;
  name: string;
  /** US-TEAM-26 — what the Team is for. */
  description: string | null;
  isDefault: boolean;
  isDemo: boolean;
  memberCount: number;
  createdAt: string;
  /** US-TEAM-25 — who is on it, and what it grants. */
  members: { memberId: string; name: string }[];
  granted: string[];
}

export interface TeamMemberSummary {
  memberId: string;
  userId: string;
  name: string;
  email: string;
}

/** Keys match @spine/shared's CAPABILITIES exactly — see packages/shared/src/schemas/permissions.ts. */
export type TeamPrivileges = Record<string, boolean>;

export interface TeamDetail {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isDemo: boolean;
  members: TeamMemberSummary[];
  privileges: TeamPrivileges;
}
