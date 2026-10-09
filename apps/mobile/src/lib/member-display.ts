import type { Member } from "./session/sign-in";

/** "Marcus Webb" → "MW"; falls back to the email's first letter. */
export function initials(member: Pick<Member, "name" | "email">): string {
  const parts = member.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return (member.email[0] ?? "?").toUpperCase();
  const letters = parts.length === 1 ? parts[0]!.slice(0, 2) : `${parts[0]![0]}${parts[parts.length - 1]![0]}`;
  return letters.toUpperCase();
}

const ROLE_LABEL: Record<string, string> = { owner: "Owner", staff: "Staff", field: "Field" };

/** "Field · Riverstone Builders" (US-MOB-02). */
export function roleLine(member: Pick<Member, "role" | "organizationName">): string {
  return `${ROLE_LABEL[member.role] ?? member.role} · ${member.organizationName}`;
}

/** "Good morning, Marcus" — by the phone's clock. */
export function greeting(member: Pick<Member, "name">, now: Date = new Date()): string {
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const first = member.name.trim().split(/\s+/)[0];
  return first ? `Good ${part}, ${first}` : `Good ${part}`;
}
