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
}
