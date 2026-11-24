/**
 * `JSON.stringify` throws on a raw `bigint` by default — and per
 * the architecture rules, money is always `bigint` minor units, so any endpoint
 * returning a Money-shaped field (e.g. leads.valueAmount) would 500
 * without this. First place in the codebase serializing a bigint over
 * HTTP (ledger/reports modules are still stubs), so there's no earlier
 * precedent to match — this patches `BigInt.prototype.toJSON` globally,
 * imported once at process start in main.ts, so every controller across
 * every module gets safe bigint serialization without repeating this per
 * response. Serializes to a decimal string (not a JS number, which would
 * lose precision above 2^53) — the same string shape
 * `@spine/shared`'s `moneySchema` (`z.coerce.bigint()`) already parses
 * back on the way in, so a round trip through the API needs no special
 * client-side handling.
 */
export function installBigIntJsonSerialization(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (BigInt.prototype as any).toJSON = function toJSON(this: bigint) {
    return this.toString();
  };
}
