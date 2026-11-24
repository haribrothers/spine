/**
 * A `?next=` value is followed only when it's a path on this site:
 * "/quotes/new" yes; "//evil.example", "/\\evil.example" and full URLs no.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

export function loginUrlFor(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`;
}
