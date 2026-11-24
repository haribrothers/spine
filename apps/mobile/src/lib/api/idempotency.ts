/**
 * A fresh `Idempotency-Key` for a mutating request (D-009). Random v4-style
 * hex; uniqueness is all the server needs.
 */
export function newIdempotencyKey(): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
