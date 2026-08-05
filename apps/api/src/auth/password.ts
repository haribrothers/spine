import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id per docs/spine-prd.md §10.3 — Better Auth defaults to scrypt
 * otherwise. `algorithm: 2` is Argon2id (see @node-rs/argon2's `Algorithm`
 * const enum); using the literal instead of the enum import avoids a
 * `const enum` cross-module access error under isolatedModules.
 */
const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(data: { password: string; hash: string }): Promise<boolean> {
  return verify(data.hash, data.password, ARGON2_OPTIONS);
}
