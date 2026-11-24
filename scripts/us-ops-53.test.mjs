// US-OPS-53 — Spine from a Docker panel (Portainer, Synology, TrueNAS,
// Dokploy, Easypanel): one pasted Compose file, nothing beside it, kept in
// step with the main stack (D-281). Run: pnpm test:scripts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const panels = read("docker/panels/docker-compose.yml");
const main = read("docker-compose.yml");
const { version } = JSON.parse(read("package.json"));

/** One top-level service's block, by indentation. */
function service(compose, name) {
  const lines = compose.split("\n");
  const start = lines.indexOf(`  ${name}:`);
  assert.ok(start > -1, `service ${name}`);
  const end = lines.findIndex((l, i) => i > start && /^ {0,2}\S/.test(l));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

const realCompose = spawnSync("docker", ["compose", "version"], { encoding: "utf8" }).status === 0;
const required = { AUTH_SECRET: "a".repeat(48), POSTGRES_PASSWORD: "pw123", APP_URL: "http://192.168.1.20:7746" };
function config(env) {
  // From an empty folder, so no .env of this repo's fills anything in.
  return spawnSync("docker", ["compose", "-f", "-", "config", "--format", "json"], {
    cwd: mkdtempSync(join(tmpdir(), "spine-panels-")),
    input: panels,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? "", ...env },
  });
}

describe("US-OPS-53 · Spine from a Docker panel", () => {
  it("needs nothing beside it: no .env file, no profiles, nothing built, no Caddyfile", () => {
    const body = panels.replace(/^#.*\n/gm, "");
    assert.doesNotMatch(body, /env_file:/);
    assert.doesNotMatch(body, /profiles:/);
    assert.doesNotMatch(body, /^\s+build:/m);
    assert.doesNotMatch(body, /Caddyfile/);
  });

  it("runs this version's images, the same as the main stack", () => {
    for (const app of ["api", "web", "proxy"]) {
      const image = `image: ghcr.io/haribrothers/spine-${app}:\${SPINE_VERSION:-${version}}`;
      assert.ok(panels.includes(image), app);
      assert.ok(main.includes(image), `main ${app}`);
    }
  });

  it("asks for the three settings Spine can't start without, and builds the rest from them", () => {
    assert.match(panels, /AUTH_SECRET: \$\{AUTH_SECRET:\?Set AUTH_SECRET, /);
    assert.match(panels, /POSTGRES_PASSWORD: \$\{POSTGRES_PASSWORD:\?Set POSTGRES_PASSWORD, /);
    assert.match(panels, /APP_URL: \$\{APP_URL:\?Set APP_URL, /);
    assert.match(panels, /DATABASE_URL: postgres:\/\/spine:\$\{POSTGRES_PASSWORD\}@db:5432\/spine/);
    assert.match(panels, /API_URL: \$\{APP_URL\}\/api/);
    assert.doesNotMatch(panels, /change-me|SERVICE_/);
  });

  it("offers every setting .env.example has, and keeps the API's volumes and healthcheck", () => {
    const example = [...read(".env.example").matchAll(/^#? ?([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]);
    // Caddy's settings are on the caddy service; the tunnel is the full profile's; the rest are internal.
    const notOnApi = new Set(["CLOUDFLARE_TUNNEL_TOKEN", "FILES_DIR", "NODE_ENV", "POSTGRES_PASSWORD", "SPINE_PORT"]);
    const api = service(panels, "api");
    for (const key of example.filter((k) => !notOnApi.has(k))) assert.match(api, new RegExp(`^ {6}${key}: `, "m"), key);
    for (const volume of ["spine_files:/data/files", "spine_snapshots:/data/snapshots"]) assert.ok(api.includes(volume), volume);
    const health = (s) => /test: \[.*\]/.exec(s)[0];
    assert.equal(health(api), health(service(main, "api")));
  });

  it("Caddy publishes Spine's port at any address, with the same settings as the main stack (D-279)", () => {
    const caddy = service(panels, "caddy");
    const mainCaddy = service(main, "caddy");
    for (const line of ['- "${SPINE_PORT:-7746}:7746"', "SITE_ADDRESS: ${SITE_ADDRESS:-:7746}", "TRUSTED_PROXIES: ${TRUSTED_PROXIES:-127.0.0.1/32}"]) {
      assert.ok(caddy.includes(line), line);
      assert.ok(mainCaddy.includes(line), `main: ${line}`);
    }
    for (const volume of ["caddy_data:/data", "caddy_config:/config"]) assert.ok(caddy.includes(volume), volume);
  });

  it("each release attaches it as docker-compose.panels.yml", () => {
    assert.match(read(".github/workflows/release.yml"), /cp docker\/panels\/docker-compose\.yml dist\/docker-compose\.panels\.yml/);
  });

  it("Docker Compose reads it as intended, and names each missing setting", { skip: !realCompose && "no docker compose here" }, () => {
    for (const key of Object.keys(required)) {
      const { [key]: _, ...others } = required;
      const missing = config(others);
      assert.notEqual(missing.status, 0, key);
      assert.match(missing.stderr, new RegExp(`required variable ${key} is missing a value: Set ${key}`), key);
    }

    const ok = config(required);
    assert.equal(ok.status, 0, ok.stderr);
    const { services } = JSON.parse(ok.stdout);
    assert.deepEqual(Object.keys(services).sort(), ["api", "caddy", "db", "web"]);
    assert.equal(services.api.environment.DATABASE_URL, "postgres://spine:pw123@db:5432/spine");
    assert.equal(services.api.environment.API_URL, "http://192.168.1.20:7746/api");
    assert.equal(services.web.environment.APP_URL, "http://192.168.1.20:7746");
    assert.deepEqual(services.caddy.ports.map((p) => `${p.published}:${p.target}`), ["7746:7746"]);

    const port = JSON.parse(config({ ...required, SPINE_PORT: "8080" }).stdout);
    assert.deepEqual(port.services.caddy.ports.map((p) => `${p.published}:${p.target}`), ["8080:7746"]);
  });
});
