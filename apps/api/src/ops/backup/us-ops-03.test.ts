import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decryptFile, encryptFile, isEncrypted, WrongPassphraseError } from "./archive-crypto";
import { backupsToPrune, remoteConfig } from "./remote";

describe("US-OPS-03 · back up everything into one file", () => {
  it("encrypts with a passphrase (AES-256-GCM) and only that passphrase opens it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "us-ops-03-"));
    const plain = join(dir, "a.tar.gz");
    writeFileSync(plain, Buffer.from("database and files ".repeat(1000)));
    await encryptFile(plain, join(dir, "a.enc"), "correct horse battery staple");
    expect(await isEncrypted(join(dir, "a.enc"))).toBe(true);
    expect(await isEncrypted(plain)).toBe(false);
    expect(readFileSync(join(dir, "a.enc")).includes(Buffer.from("database and files"))).toBe(false);
    await decryptFile(join(dir, "a.enc"), join(dir, "b.tar.gz"), "correct horse battery staple");
    expect(readFileSync(join(dir, "b.tar.gz")).equals(readFileSync(plain))).toBe(true);
    await expect(decryptFile(join(dir, "a.enc"), join(dir, "c.tar.gz"), "wrong")).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it("notices a changed byte", async () => {
    const dir = mkdtempSync(join(tmpdir(), "us-ops-03-"));
    writeFileSync(join(dir, "a"), "ledger");
    await encryptFile(join(dir, "a"), join(dir, "a.enc"), "pass");
    const bytes = readFileSync(join(dir, "a.enc"));
    bytes[bytes.length - 20] = bytes[bytes.length - 20]! ^ 0xff;
    writeFileSync(join(dir, "a.enc"), bytes);
    await expect(decryptFile(join(dir, "a.enc"), join(dir, "b"), "pass")).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it("keeps the newest of each of the last 7 days and 4 weeks off-site, and prunes the rest", () => {
    // Two a day for 40 days, ending Friday 23 October 2026.
    const names: string[] = [];
    for (let d = 0; d < 40; d++) {
      const day = new Date(Date.UTC(2026, 9, 23 - d));
      const ymd = day.toISOString().slice(0, 10).replace(/-/g, "");
      names.push(`spine-backup-${ymd}-020000.tar.gz.enc`, `spine-backup-${ymd}-140000.tar.gz.enc`);
    }
    const pruned = new Set(backupsToPrune([...names, "notes.txt"]));
    const kept = names.filter((n) => !pruned.has(n)).sort();
    // 7 daily (17–23 Oct, the 14:00 copy), then the newest of each of 4 weeks before them (Fri 16 Oct, Sundays 11 and 4 Oct, 27 Sep).
    expect(kept).toEqual(
      ["20260927", "20261004", "20261011", "20261016", "20261017", "20261018", "20261019", "20261020", "20261021", "20261022", "20261023"].map((d) => `spine-backup-${d}-140000.tar.gz.enc`),
    );
    expect(pruned.has("notes.txt")).toBe(false);
  });

  it("reads the off-site target from BACKUP_REMOTE, with its own keys", () => {
    expect(remoteConfig({})).toBeNull();
    expect(remoteConfig({ BACKUP_REMOTE: "s3://spine-backups/acme/", BACKUP_REMOTE_ACCESS_KEY: "k", BACKUP_REMOTE_SECRET_KEY: "s", BACKUP_REMOTE_ENDPOINT: "https://x.r2.cloudflarestorage.com" })).toMatchObject({ bucket: "spine-backups", prefix: "acme/", region: "auto" });
    expect(() => remoteConfig({ BACKUP_REMOTE: "spine-backups" })).toThrow(/s3:\/\/bucket\/folder/);
    expect(() => remoteConfig({ BACKUP_REMOTE: "s3://b/f" })).toThrow(/BACKUP_REMOTE_ACCESS_KEY/);
  });
});
