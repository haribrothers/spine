// US-OPS-01 — install Spine with one command. Run: pnpm test:scripts
// install.sh runs against a fake `docker` that records what it was asked to do.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const repo = new URL("..", import.meta.url).pathname;

/** What install.sh (and the fake docker) run, besides docker. */
const TOOLS = ["sh", "dirname", "tr", "dd", "awk", "sed", "tail", "head", "cat", "mkdir", "rm", "cp", "chmod"];

const FAKE_DOCKER = `#!/bin/sh
echo "$*" >> "$FAKE_DOCKER_LOG"
case "$1 $2" in
  "version --format") [ -z "$FAKE_DOCKER_DOWN" ] || exit 1; echo "\${FAKE_DOCKER_VERSION:-27.3.1}" ;;
  "compose version") echo "\${FAKE_COMPOSE_VERSION:-2.29.7}" ;;
  *) case "$*" in *" up "*) exit "\${FAKE_UP_EXIT:-0}" ;; esac ;;
esac
`;

/** A release's files in a fresh folder (or a clone's layout), and a PATH with the fake docker unless told otherwise. */
function setup({ layout = "release", docker = true, template = layout === "release" ? "env.example" : ".env.example" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "spine-install-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const scriptDir = layout === "clone" ? join(dir, "scripts") : dir;
  mkdirSync(scriptDir, { recursive: true });
  copyFileSync(join(repo, "scripts/install.sh"), join(scriptDir, "install.sh"));
  copyFileSync(join(repo, "docker-compose.yml"), join(dir, "docker-compose.yml"));
  // A release ships env.example (GitHub renames files starting with a dot); a clone has .env.example.
  copyFileSync(join(repo, ".env.example"), join(dir, template));
  if (docker) {
    writeFileSync(join(bin, "docker"), FAKE_DOCKER);
    chmodSync(join(bin, "docker"), 0o755);
  }
  // PATH is this folder alone, with links to the tools install.sh uses: a real
  // docker in /usr/bin (as on Linux) must never be found, let alone run.
  for (const tool of TOOLS) {
    const found = spawnSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8" }).stdout.trim();
    if (found && !existsSync(join(bin, tool))) symlinkSync(found, join(bin, tool));
  }
  const log = join(dir, "docker.log");
  const run = (args = [], env = {}) => {
    const result = spawnSync("sh", [join(scriptDir, "install.sh"), ...args], {
      cwd: tmpdir(),
      encoding: "utf8",
      input: "",
      env: { PATH: bin, HOME: dir, FAKE_DOCKER_LOG: log, ...env },
    });
    return { ...result, calls: existsSync(log) ? readFileSync(log, "utf8") : "" };
  };
  return { dir, run, env: () => readFileSync(join(dir, ".env"), "utf8") };
}

const value = (env, key) => new RegExp(`^${key}=(.*)$`, "m").exec(env)?.[1];
const override = (dir) => join(dir, "docker-compose.override.yml");
/** A real `docker compose`, when this machine has one (CI does), to read the files as Docker will. */
const realCompose = spawnSync("docker", ["compose", "version"], { encoding: "utf8" }).status === 0;

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

  it("works from a release's env.example and from a clone's .env.example", () => {
    for (const template of ["env.example", ".env.example"]) {
      const { run, env } = setup({ template });
      assert.equal(run(["--non-interactive"]).status, 0, template);
      assert.match(value(env(), "AUTH_SECRET"), /^[A-Za-z0-9]{48}$/, template);
    }
  });

  it("two installs never share a secret", () => {
    const a = setup();
    const b = setup();
    a.run(["--non-interactive"]);
    b.run(["--non-interactive"]);
    assert.notEqual(value(a.env(), "AUTH_SECRET"), value(b.env(), "AUTH_SECRET"));
  });

  it("asks nothing with --non-interactive or APP_URL set, defaulting to http://localhost:7746", () => {
    const quiet = setup();
    assert.equal(quiet.run(["--non-interactive"]).status, 0);
    assert.equal(value(quiet.env(), "APP_URL"), "http://localhost:7746");
    assert.equal(value(quiet.env(), "SPINE_PORT"), "7746");
    const fromEnv = setup();
    assert.equal(fromEnv.run([], { APP_URL: "http://192.168.1.20" }).status, 0);
    assert.equal(value(fromEnv.env(), "API_URL"), "http://192.168.1.20:7746/api");
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

  it("on your network: one port at any address, plain HTTP, the port in the address and no override", () => {
    const { run, env, dir } = setup();
    const result = run(["--app-url", "http://10.85.0.30"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(value(env(), "APP_URL"), "http://10.85.0.30:7746");
    assert.equal(value(env(), "API_URL"), "http://10.85.0.30:7746/api");
    assert.equal(value(env(), "SPINE_PORT"), "7746");
    assert.equal(value(env(), "SITE_ADDRESS"), undefined);
    assert.equal(existsSync(override(dir)), false);
    assert.match(result.stdout, /Spine is running at http:\/\/10\.85\.0\.30:7746 — open it/);
    assert.match(result.stdout, /It also opens at http:\/\/localhost:7746 on this machine/);
  });

  it("--port, or a port in the address, is the port Spine opens on; port 80 stays out of the address", () => {
    for (const [args, url, port] of [
      [["--port", "8080", "--non-interactive"], "http://localhost:8080", "8080"],
      [["--app-url", "http://192.168.1.20:9000"], "http://192.168.1.20:9000", "9000"],
      [["--app-url=http://192.168.1.20:9000", "--port=9000"], "http://192.168.1.20:9000", "9000"],
      [["--app-url", "http://spine.local", "--port", "80"], "http://spine.local", "80"],
    ]) {
      const { run, env, dir } = setup();
      const result = run(args);
      assert.equal(result.status, 0, `${args.join(" ")}: ${result.stderr}`);
      assert.equal(value(env(), "APP_URL"), url, args.join(" "));
      assert.equal(value(env(), "SPINE_PORT"), port, args.join(" "));
      assert.equal(existsSync(override(dir)), false, args.join(" "));
    }
  });

  it("the summary names this machine's IP when it can tell, for the other devices on the network", () => {
    const { run, dir } = setup();
    writeFileSync(join(dir, "bin", "ipconfig"), '#!/bin/sh\n[ "$2" = en0 ] && echo 10.85.0.30\n');
    chmodSync(join(dir, "bin", "ipconfig"), 0o755);
    const result = run(["--non-interactive"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /It also opens at http:\/\/localhost:7746 on this machine, and at http:\/\/10\.85\.0\.30:7746 from other devices on your network\./);
  });

  it("with a domain: HTTPS from Caddy on 80 and 443, the plain port kept to this machine", () => {
    const { run, env, dir } = setup();
    const result = run(["--app-url", "https://spine.example.com"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(value(env(), "APP_URL"), "https://spine.example.com");
    assert.equal(value(env(), "SITE_ADDRESS"), "spine.example.com, :7746");
    assert.equal(value(env(), "SPINE_PORT"), "127.0.0.1:7746");
    assert.match(readFileSync(override(dir), "utf8"), /^services:\n {2}caddy:\n {4}ports:\n {6}- "80:80"\n {6}- "443:443"$/m);
    assert.match(result.stdout, /Wrote docker-compose\.override\.yml: Caddy takes ports 80 and 443 for spine\.example\.com's certificate\./);
    assert.doesNotMatch(result.stdout, /It also opens at/);
  });

  it("behind something that handles HTTPS (Tailscale, a tunnel, a proxy): Spine stays on its port and believes the proxy", () => {
    const { run, env, dir } = setup();
    const result = run(["--app-url", "https://spine.tail1234.ts.net", "--behind-proxy"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(value(env(), "APP_URL"), "https://spine.tail1234.ts.net");
    assert.equal(value(env(), "SPINE_PORT"), "7746");
    assert.equal(value(env(), "SITE_ADDRESS"), undefined);
    assert.equal(value(env(), "TRUSTED_PROXIES"), "private_ranges");
    assert.equal(existsSync(override(dir)), false);
  });

  it("refuses what can't work, before writing anything", () => {
    for (const [args, message] of [
      [["--port", "web", "--non-interactive"], /--port must be a number from 1 to 65535 \(got: web\)/],
      [["--port", "70000", "--non-interactive"], /--port must be a number from 1 to 65535/],
      [["--app-url", "http://localhost:0"], /The address's port must be a number from 1 to 65535/],
      [["--app-url", "http://localhost:8080", "--port", "9090"], /already has port 8080, and --port says 9090\. Give the port once\./],
      [["--app-url", "https://10.85.0.30"], /10\.85\.0\.30 can't get an HTTPS certificate: it isn't a domain on the internet\. Use http:\/\/10\.85\.0\.30:7746, or for HTTPS without a domain, Tailscale/],
      [["--app-url", "https://localhost"], /localhost can't get an HTTPS certificate/],
      [["--app-url", "https://spine.local"], /spine\.local can't get an HTTPS certificate/],
      [["--app-url", "https://spine.example.com:8443"], /Caddy needs ports 80 and 443 to get the certificate, so the address can't have port 8443\. .*--behind-proxy/],
      [["--port"], /--port needs a number/],
    ]) {
      const { run, dir } = setup();
      const result = run(args);
      assert.equal(result.status, 1, args.join(" "));
      assert.match(result.stderr, message, args.join(" "));
      assert.equal(existsSync(join(dir, ".env")), false, args.join(" "));
      assert.equal(existsSync(override(dir)), false, args.join(" "));
    }
  });

  it("a domain never overwrites a docker-compose.override.yml that's already there", () => {
    const { run, dir } = setup();
    writeFileSync(override(dir), "services: {}\n");
    const result = run(["--app-url", "https://spine.example.com"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /docker-compose\.override\.yml is already here.*"80:80" and "443:443"/);
    assert.equal(readFileSync(override(dir), "utf8"), "services: {}\n");
    assert.equal(existsSync(join(dir, ".env")), false);
  });

  it("with .env already there, --app-url and --port change nothing and it says how to change the address", () => {
    const { run, dir } = setup();
    writeFileSync(join(dir, ".env"), "APP_URL=http://spine.local\nAUTH_SECRET=mine\n");
    const result = run(["--app-url", "http://localhost", "--port", "8080"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(dir, ".env"), "utf8"), "APP_URL=http://spine.local\nAUTH_SECRET=mine\n");
    assert.equal(existsSync(override(dir)), false);
    assert.match(result.stdout, /--app-url, --port and --behind-proxy only apply when there's no \.env yet/);
    assert.match(result.stdout, /change APP_URL and API_URL in \.env; to change the port, SPINE_PORT/);
    assert.match(result.stdout, /running at http:\/\/spine\.local/);
    assert.doesNotMatch(setup().run(["--non-interactive"]).stdout, /only apply when/);
  });

  it("says what to do when another program has the port", () => {
    const result = setup().run(["--non-interactive"], { FAKE_UP_EXIT: "1" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /"port is already allocated" means another program has the port: install with --port <another>, or change SPINE_PORT in \.env\./);
  });

  it("Docker Compose reads it as intended: Caddy publishes Spine's port, or 80 and 443 too for a domain", { skip: !realCompose && "no docker compose here" }, () => {
    const published = (dir) => {
      const config = spawnSync("docker", ["compose", "--profile", "minimal", "config", "--format", "json"], { cwd: dir, encoding: "utf8" });
      assert.equal(config.status, 0, config.stderr);
      const caddy = JSON.parse(config.stdout).services.caddy;
      return { ports: caddy.ports.map((p) => `${p.host_ip ? `${p.host_ip}:` : ""}${p.published}:${p.target}`).sort(), site: caddy.environment.SITE_ADDRESS };
    };
    const lan = setup();
    assert.equal(lan.run(["--app-url", "http://10.85.0.30", "--port", "8080"]).status, 0);
    assert.deepEqual(published(lan.dir), { ports: ["8080:7746"], site: ":7746" });
    const domain = setup();
    assert.equal(domain.run(["--app-url", "https://spine.example.com"]).status, 0);
    assert.deepEqual(published(domain.dir), { ports: ["127.0.0.1:7746:7746", "443:443", "80:80"], site: "spine.example.com, :7746" });
  });
});
