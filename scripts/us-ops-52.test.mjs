// US-OPS-52 — Spine on Coolify (and platforms like it) stays in step with the
// main stack. Run: pnpm test:scripts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const coolify = read("docker/coolify/docker-compose.yml");
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

describe("US-OPS-52 · Spine on Coolify", () => {
  it("Caddy sits behind Coolify's proxy: no published ports, plain HTTP on :80, the proxy trusted for visitors' addresses", () => {
    const caddy = service(coolify, "caddy");
    assert.doesNotMatch(caddy, /ports:/);
    assert.match(caddy, /- SERVICE_URL_CADDY_80/);
    assert.match(caddy, /- SITE_ADDRESS=:80/);
    assert.match(caddy, /- TRUSTED_PROXIES=private_ranges/);
  });

  it("routes with the same proxy image as the main stack, with no Caddyfile of its own (D-280)", () => {
    assert.doesNotMatch(coolify, /Caddyfile|content: \|/);
    assert.match(service(coolify, "caddy"), /image: ghcr\.io\/haribrothers\/spine-proxy:/);
  });

  it("runs this version's images", () => {
    for (const app of ["api", "web", "proxy"]) assert.ok(coolify.includes(`image: ghcr.io/haribrothers/spine-${app}:\${SPINE_VERSION:-${version}}`), app);
  });

  it("offers every setting .env.example has, and keeps the API's volumes and healthcheck", () => {
    const example = [...read(".env.example").matchAll(/^#? ?([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]);
    // SPINE_PORT is the port Docker publishes for Caddy (D-279); behind Coolify nothing is published.
    const notHere = new Set(["CLOUDFLARE_TUNNEL_TOKEN", "FILES_DIR", "NODE_ENV", "POSTGRES_PASSWORD", "SPINE_PORT"]);
    const api = service(coolify, "api");
    for (const key of example.filter((k) => !notHere.has(k))) assert.match(api, new RegExp(`^ {6}${key}: `, "m"), key);
    for (const volume of ["spine_files:/data/files", "spine_snapshots:/data/snapshots"]) assert.ok(api.includes(volume), volume);
    const health = (s) => /test: \[.*\]/.exec(s)[0];
    assert.equal(health(api), health(service(main, "api")));
  });

  it("generates the secrets once with Coolify, and never ships a default for them", () => {
    assert.match(coolify, /AUTH_SECRET: \$\{SERVICE_PASSWORD_64_AUTH\}/);
    assert.match(coolify, /POSTGRES_PASSWORD: \$\{SERVICE_PASSWORD_POSTGRES\}/);
    assert.doesNotMatch(coolify, /change-me/);
  });
});
