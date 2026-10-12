export interface InvitationRow {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  inviterId: string;
  organizationId: string;
  /** US-TEAM-21 — who sent it and when, the Teams it joins and its link. */
  inviterName?: string | null;
  createdAt?: string;
  teams?: { id: string; name: string }[];
  acceptUrl?: string;
}
