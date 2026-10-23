import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;

/**
 * US-OPS-03 (D-105) — a backup encrypted with a passphrase: AES-256-GCM, so a
 * wrong passphrase or a changed byte is caught on restore. The key comes from
 * the passphrase through scrypt. Layout: the magic, a 16-byte salt, a 12-byte
 * nonce, the ciphertext, then the 16-byte authentication tag.
 */
const MAGIC = Buffer.from("SPINEBK1");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export class WrongPassphraseError extends Error {
  constructor() {
    super("The passphrase doesn't open this backup, or the file was changed after it was made.");
  }
}

async function keyFor(passphrase: string, salt: Buffer): Promise<Buffer> {
  return scrypt(passphrase, salt, 32, SCRYPT);
}

export async function encryptFile(source: string, target: string, passphrase: string): Promise<void> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", await keyFor(passphrase, salt), iv);
  const out = createWriteStream(target);
  out.write(Buffer.concat([MAGIC, salt, iv]));
  await pipeline(createReadStream(source), cipher, out, { end: false });
  await new Promise<void>((resolve, reject) => out.end(cipher.getAuthTag(), (err?: Error | null) => (err ? reject(err) : resolve())));
}

export async function isEncrypted(path: string): Promise<boolean> {
  const handle = await open(path, "r");
  try {
    const head = Buffer.alloc(MAGIC.length);
    await handle.read(head, 0, MAGIC.length, 0);
    return head.equals(MAGIC);
  } finally {
    await handle.close();
  }
}

export async function decryptFile(source: string, target: string, passphrase: string): Promise<void> {
  const { size } = await stat(source);
  if (size < HEADER_BYTES + TAG_BYTES) throw new WrongPassphraseError();
  const handle = await open(source, "r");
  const header = Buffer.alloc(HEADER_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  try {
    await handle.read(header, 0, HEADER_BYTES, 0);
    await handle.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
  } finally {
    await handle.close();
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("This backup isn't encrypted.");
  const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = header.subarray(MAGIC.length + SALT_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", await keyFor(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  try {
    await pipeline(createReadStream(source, { start: HEADER_BYTES, end: size - TAG_BYTES - 1 }), decipher, createWriteStream(target));
  } catch {
    await rm(target, { force: true });
    throw new WrongPassphraseError();
  }
}
