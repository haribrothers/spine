// US-OPS-50 — upgrade Spine with one command. Run: pnpm test:scripts
// upgrade.sh runs against a fake `docker` and a fake backup.sh that record what they were asked to do.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { releaseCompose } from "./release/release-compose.mjs";

const repo = new URL("..", import.meta.url).pathname;
const compose = readFileSync(join(repo, "docker-compose.yml"), "utf8");

const FAKE_DOCKER = `#!/bin/sh
echo "$*" >> "$FAKE_DOCKER_LOG"
case "$*" in
  "compose ps -q api") echo abc123 ;;
  "compose ps --services --status running") printf 'api\\nweb\\ndb\\ncaddy\\n' ;;
  *" up "*) exit "\${FAKE_UP_EXIT:-0}" ;;
esac
`;
const FAKE_BACKUP = `#!/bin/sh
echo backup >> "$FAKE_DOCKER_LOG"
[ -z "$FAKE_BACKUP_FAIL" ] || exit 1
echo "Backing up Spine…"
echo "Backup saved: backups/spine-backup-20261024-020000.tar.gz (1.4M)"
`;

/** An installed release (1.0.0-beta.1) and the next one's files in a folder. */
function setup({ installed = "1.0.0-beta.1", next = "1.0.0-beta.2", nextFiles = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "spine-upgrade-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "docker"), FAKE_DOCKER);
  chmodSync(join(bin, "docker"), 0o755);
  const install = join(dir, "spine");
  mkdirSync(install);
  writeFileSync(join(install, "docker-compose.yml"), releaseCompose(compose, installed));
  copyFileSync(join(repo, "scripts/upgrade.sh"), join(install, "upgrade.sh"));
  writeFileSync(join(install, "backup.sh"), FAKE_BACKUP);
  chmodSync(join(install, "backup.sh"), 0o755);
  writeFileSync(join(install, ".env"), "APP_URL=http://localhost\nAUTH_SECRET=keep-me\n");
  const files = join(dir, "next");
  if (nextFiles) {
    mkdirSync(files);
    writeFileSync(join(files, "docker-compose.yml"), releaseCompose(compose, next));
    for (const f of ["install.sh", "backup.sh", "restore.sh", "upgrade.sh"]) writeFileSync(join(files, f), `#!/bin/sh\n# ${next}\n`);
    copyFileSync(join(repo, "docker/Caddyfile"), join(files, "Caddyfile"));
    copyFileSync(join(repo, ".env.example"), join(files, ".env.example"));
    const sums = ["docker-compose.yml", "install.sh", "backup.sh", "restore.sh", "upgrade.sh", "Caddyfile", ".env.example"]
      .map((f) => `${createHash("sha256").update(readFileSync(join(files, f))).digest("hex")}  ${f}`)
      .join("\n");
    writeFileSync(join(files, "SHA256SUMS"), `${sums}\n`);
  }
  const log = join(dir, "docker.log");
  const run = (args = [], env = {}) => {
    const result = spawnSync("sh", [join(install, "upgrade.sh"), ...args], { encoding: "utf8", env: { PATH: `${bin}:/usr/bin:/bin`, HOME: dir, FAKE_DOCKER_LOG: log, ...env } });
    return { ...result, calls: existsSync(log) ? readFileSync(log, "utf8") : "" };
  };
  return { install, files, run, read: (f) => readFileSync(join(install, f), "utf8") };
}

describe("US-OPS-50 · upgrade Spine with one command", () => {
  it("backs up, takes the new version's checked files, sets SPINE_VERSION and restarts, keeping .env otherwise", () => {
    const { run, files, read, install } = setup();
    const result = run(["--version", "1.0.0-beta.2", "--files", files]);
    assert.equal(result.status, 0, result.stderr);
    const order = result.calls.split("\n").filter(Boolean);
    assert.ok(order.indexOf("backup") < order.findIndex((l) => l.includes(" up ")), "the backup comes before the restart");
    assert.match(read(".env"), /^AUTH_SECRET=keep-me$/m);
    assert.match(read(".env"), /^SPINE_VERSION=1\.0\.0-beta\.2$/m);
    assert.match(read("docker-compose.yml"), /spine-api:\$\{SPINE_VERSION:-1\.0\.0-beta\.2\}/);
    assert.match(readFileSync(join(install, ".previous/docker-compose.yml"), "utf8"), /SPINE_VERSION:-1\.0\.0-beta\.1/);
    assert.match(result.calls, /^compose --profile minimal up -d --no-build --wait/m);
    assert.match(result.stdout, /Spine is now 1\.0\.0-beta\.2\. Your backup is backups\/spine-backup-20261024-020000\.tar\.gz\./);
  });

  it("does nothing when it's already that version, and never goes back one", () => {
    const same = setup().run(["--version", "1.0.0-beta.1"]);
    assert.equal(same.status, 0);
    assert.match(same.stdout, /Spine is already 1\.0\.0-beta\.1\./);
    assert.doesNotMatch(same.calls, /backup|up -d/);
    const older = setup({ installed: "1.0.0" }).run(["--version", "1.0.0-rc.1"]);
    assert.equal(older.status, 1);
    assert.match(older.stderr, /1\.0\.0-rc\.1 is older than this install \(1\.0\.0\), and Spine can't go back a version/);
  });

  it("orders pre-releases before the release: beta.10 after beta.2, rc after beta, 1.0.0 after rc", () => {
    for (const [from, to] of [["1.0.0-beta.2", "1.0.0-beta.10"], ["1.0.0-beta.10", "1.0.0-rc.1"], ["1.0.0-rc.1", "1.0.0"], ["1.0.0", "1.0.1"]]) {
      const { run, files } = setup({ installed: from, next: to });
      assert.equal(run(["--version", to, "--files", files]).status, 0, `${from} → ${to}`);
    }
  });

  it("refuses files that don't match their checksums or name another version, changing nothing", () => {
    const tampered = setup();
    writeFileSync(join(tampered.files, "install.sh"), "#!/bin/sh\necho changed\n");
    const r1 = tampered.run(["--version", "1.0.0-beta.2", "--files", tampered.files]);
    assert.equal(r1.status, 1);
    assert.match(r1.stderr, /don't match their checksums, so nothing was changed/);
    assert.doesNotMatch(r1.calls, /backup/);
    const wrong = setup({ next: "1.0.0-beta.3" });
    const r2 = wrong.run(["--version", "1.0.0-beta.2", "--files", wrong.files]);
    assert.equal(r2.status, 1);
    assert.match(r2.stderr, /aren't Spine 1\.0\.0-beta\.2's/);
    assert.doesNotMatch(wrong.read(".env"), /SPINE_VERSION/);
  });

  it("stops before changing anything when the backup fails", () => {
    const { run, files, read } = setup();
    const result = run(["--version", "1.0.0-beta.2", "--files", files], { FAKE_BACKUP_FAIL: "1" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /The backup didn't finish, so nothing was upgraded/);
    assert.doesNotMatch(read(".env"), /SPINE_VERSION/);
    assert.doesNotMatch(result.calls, / up /);
  });

  it("when the new version doesn't start, says the data is safe and how to go back", () => {
    const { run, files } = setup();
    const result = run(["--version", "1.0.0-beta.2", "--files", files], { FAKE_UP_EXIT: "1" });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Spine 1\.0\.0-beta\.2 didn't start\. See why with: docker compose logs api/);
    assert.match(result.stdout, /Your data is safe: a failed migration changes nothing, and your backup is backups\/spine-backup-20261024-020000\.tar\.gz/);
    assert.match(result.stdout, /set SPINE_VERSION=1\.0\.0-beta\.1 in \.env, put the files in \.previous\/ back, and run docker compose up -d/);
  });
});

describe("the self-hosting scripts", () => {
  it("never put a character like … straight after a $variable (macOS's sh reads it as part of the name)", async () => {
    const { readdirSync } = await import("node:fs");
    const scripts = [...readdirSync(join(repo, "scripts")).filter((f) => f.endsWith(".sh")).map((f) => `scripts/${f}`), ...readdirSync(join(repo, "scripts/ci")).map((f) => `scripts/ci/${f}`)];
    for (const file of scripts) {
      const bad = readFileSync(join(repo, file), "utf8")
        .split("\n")
        .flatMap((line, i) => (/\$[A-Za-z_][A-Za-z0-9_]*[^\x00-\x7F]/.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : []));
      assert.deepEqual(bad, [], "use ${name} before a non-ASCII character");
    }
  });
});
