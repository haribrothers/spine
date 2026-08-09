export interface TeamSummary {
  id: string;
  name: string;
  isDefault: boolean;
  memberCount: number;
  createdAt: string;
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
  isDefault: boolean;
  members: TeamMemberSummary[];
  privileges: TeamPrivileges;
}
