#!/usr/bin/env node
// US-OPS-51 (D-262) — the docker-compose.yml a release publishes: the repo's
// own, with the api and web services pulling that version's images instead of
// building from source, so an install builds nothing. A release's files sit
// side by side, so the Caddyfile is mounted from `./Caddyfile`.
//   node scripts/release/release-compose.mjs 1.0.0 > dist/docker-compose.yml
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const IMAGE_PREFIX = "ghcr.io/haribrothers/spine";

/** Replaces each service's `build:` block with `image: <prefix>-<service>:<version>`. */
export function releaseCompose(compose, version, services = ["api", "web"]) {
  const lines = compose.split("\n");
  const out = [];
  let current = null;
  const replaced = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const service = /^ {2}([a-z0-9_-]+):\s*$/.exec(line);
    if (service) current = service[1];
    if (current && services.includes(current) && /^ {4}build:\s*$/.test(line)) {
      out.push(`    image: ${IMAGE_PREFIX}-${current}:${version}`);
      replaced.add(current);
      while (i + 1 < lines.length && /^ {6,}\S/.test(lines[i + 1])) i++;
      continue;
    }
    out.push(line);
  }
  const missing = services.filter((s) => !replaced.has(s));
  if (missing.length) throw new Error(`No build block to replace for: ${missing.join(", ")}`);
  return out.join("\n").replaceAll("./docker/Caddyfile:", "./Caddyfile:");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) {
    console.error("Usage: release-compose.mjs <version>");
    process.exit(1);
  }
  process.stdout.write(releaseCompose(readFileSync(new URL("../../docker-compose.yml", import.meta.url), "utf8"), version));
}
