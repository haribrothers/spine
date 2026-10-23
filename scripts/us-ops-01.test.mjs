// US-OPS-01 — install Spine with one command. Run: pnpm test:scripts
// install.sh runs against a fake `docker` that records what it was asked to do.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const repo = new URL("..", import.meta.url).pathname;

const FAKE_DOCKER = `#!/bin/sh
echo "$*" >> "$FAKE_DOCKER_LOG"
case "$1 $2" in
  "version --format") [ -z "$FAKE_DOCKER_DOWN" ] || exit 1; echo "\${FAKE_DOCKER_VERSION:-27.3.1}" ;;
  "compose version") echo "\${FAKE_COMPOSE_VERSION:-2.29.7}" ;;
  *) case "$*" in *" up "*) exit "\${FAKE_UP_EXIT:-0}" ;; esac ;;
esac
`;

/** A release's files in a fresh folder (or a clone's layout), and a PATH with the fake docker unless told otherwise. */
function setup({ layout = "release", docker = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "spine-install-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const scriptDir = layout === "clone" ? join(dir, "scripts") : dir;
  mkdirSync(scriptDir, { recursive: true });
  copyFileSync(join(repo, "scripts/install.sh"), join(scriptDir, "install.sh"));
  copyFileSync(join(repo, "docker-compose.yml"), join(dir, "docker-compose.yml"));
  copyFileSync(join(repo, ".env.example"), join(dir, ".env.example"));
  if (docker) {
    writeFileSync(join(bin, "docker"), FAKE_DOCKER);
    chmodSync(join(bin, "docker"), 0o755);
  }
  const log = join(dir, "docker.log");
  const run = (args = [], env = {}) => {
    const result = spawnSync("sh", [join(scriptDir, "install.sh"), ...args], {
      cwd: tmpdir(),
      encoding: "utf8",
      input: "",
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: dir, FAKE_DOCKER_LOG: log, ...env },
    });
    return { ...result, calls: existsSync(log) ? readFileSync(log, "utf8") : "" };
  };
  return { dir, run, env: () => readFileSync(join(dir, ".env"), "utf8") };
}

const value = (env, key) => new RegExp(`^${key}=(.*)$`, "m").exec(env)?.[1];

describe("US-OPS-01 · install Spine with one command", () => {
  it("on a clean machine: checks Docker and Compose, creates .env with random secrets and the address, and starts the minimal profile", () => {
    const { run, env, dir } = setup();
    const result = run(["--app-url", "https://spine.example.com/"]);
    assert.equal(result.status, 0, result.stderr);
    const settings = env();
    assert.equal(value(settings, "APP_URL"), "https://spine.example.com");
    assert.equal(value(settings, "API_URL"), "https://spine.example.com/api");
    assert.match(value(settings, "AUTH_SECRET"), /^[A-Za-z0-9]{48}$/);
    const password = value(settings, "POSTGRES_PASSWORD");
    assert.match(password, /^[A-Za-z0-9]{32}$/);
    assert.equal(value(settings, "DATABASE_URL"), `postgres://spine:${password}@db:5432/spine`);
    assert.equal(statSync(join(dir, ".env")).mode & 0o777, 0o600);
    assert.match(result.calls, /^version --format/m);
    assert.match(result.calls, /^compose version --short/m);
    assert.match(result.calls, /^compose --profile minimal up -d --no-build --wait/m);
    assert.match(result.stdout, /Spine is running at https:\/\/spine\.example\.com — open it to create the first account\./);
    assert.match(result.stdout, /Logs: +docker compose logs -f/);
    assert.match(result.stdout, /Back up: +\.\/backup\.sh/);
    assert.match(result.stdout, /Upgrade: +\.\/upgrade\.sh/);
  });

  it("two installs never share a secret", () => {
    const a = setup();
    const b = setup();
    a.run(["--non-interactive"]);
    b.run(["--non-interactive"]);
    assert.notEqual(value(a.env(), "AUTH_SECRET"), value(b.env(), "AUTH_SECRET"));
  });

  it("asks nothing with --non-interactive or APP_URL set, defaulting to http://localhost", () => {
    const quiet = setup();
    assert.equal(quiet.run(["--non-interactive"]).status, 0);
    assert.equal(value(quiet.env(), "APP_URL"), "http://localhost");
    const fromEnv = setup();
    assert.equal(fromEnv.run([], { APP_URL: "http://192.168.1.20" }).status, 0);
    assert.equal(value(fromEnv.env(), "API_URL"), "http://192.168.1.20/api");
  });

  it("with .env already there, doesn't change it and just starts Spine", () => {
    const { run, dir } = setup();
    writeFileSync(join(dir, ".env"), "APP_URL=https://kept.example.com\nAUTH_SECRET=mine\n");
    const result = run(["--app-url", "https://other.example.com"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(dir, ".env"), "utf8"), "APP_URL=https://kept.example.com\nAUTH_SECRET=mine\n");
    assert.match(result.stdout, /Keeping your existing \.env/);
    assert.match(result.stdout, /running at https:\/\/kept\.example\.com/);
    assert.match(result.calls, / up -d --no-build/);
  });

  it("from a clone, it finds the Compose file one folder up and names the scripts there", () => {
    const { run } = setup({ layout: "clone" });
    const result = run(["--non-interactive", "--profile", "full"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.calls, /^compose --profile full up/m);
    assert.match(result.stdout, /Back up: +scripts\/backup\.sh/);
  });

  it("a missing or old prerequisite stops it with a message naming what to install", () => {
    const missing = setup({ docker: false }).run(["--non-interactive"]);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Docker isn't installed\. Install Docker 24 or newer/);
    const down = setup().run(["--non-interactive"], { FAKE_DOCKER_DOWN: "1" });
    assert.equal(down.status, 1);
    assert.match(down.stderr, /Docker is installed but isn't running/);
    const old = setup().run(["--non-interactive"], { FAKE_DOCKER_VERSION: "20.10.24" });
    assert.match(old.stderr, /Docker 20\.10\.24 is too old\. Spine needs Docker 24 or newer\./);
    const oldCompose = setup().run(["--non-interactive"], { FAKE_COMPOSE_VERSION: "v2.12.2" });
    assert.match(oldCompose.stderr, /Docker Compose 2\.12\.2 is too old\. Spine needs Compose 2\.20 or newer\./);
    for (const r of [down, old, oldCompose]) assert.equal(r.status, 1);
  });

  it("refuses an address without http:// or https://, and says when Spine didn't start", () => {
    const bad = setup().run(["--app-url", "spine.example.com"]);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /must start with http:\/\/ or https:\/\//);
    const notStarted = setup().run(["--non-interactive"], { FAKE_UP_EXIT: "1" });
    assert.equal(notStarted.status, 1);
    assert.match(notStarted.stderr, /Spine didn't start\. See why with: docker compose logs api/);
  });
});
