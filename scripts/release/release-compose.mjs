#!/usr/bin/env node
// US-OPS-51 (D-262) — the docker-compose.yml a release publishes: the repo's
// own, with the api and web services pulling that version's images and no
// way to build from source, so an install builds nothing. A release's files sit
// side by side, so the Caddyfile is mounted from `./Caddyfile`.
//   node scripts/release/release-compose.mjs 1.0.0 > dist/docker-compose.yml
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const IMAGE_PREFIX = "ghcr.io/haribrothers/spine";

/**
 * Drops each service's `build:` block and makes its image default to this
 * version (`${SPINE_VERSION:-<version>}`, so upgrade.sh can still choose one).
 */
export function releaseCompose(compose, version, services = ["api", "web"]) {
  const lines = compose.split("\n");
  const out = [];
  let current = null;
  const pinned = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const service = /^ {2}([a-z0-9_-]+):\s*$/.exec(line);
    if (service) current = service[1];
    if (current && services.includes(current)) {
      if (/^ {4}build:\s*$/.test(line)) {
        while (i + 1 < lines.length && /^ {6,}\S/.test(lines[i + 1])) i++;
        continue;
      }
      const image = /^( {4}image: )(\S+):\$\{SPINE_VERSION:-[^}]+\}\s*$/.exec(line);
      if (image) {
        if (image[2] !== `${IMAGE_PREFIX}-${current}`) throw new Error(`${current} names ${image[2]}, not ${IMAGE_PREFIX}-${current}`);
        out.push(`${image[1]}${image[2]}:\${SPINE_VERSION:-${version}}`);
        pinned.add(current);
        continue;
      }
    }
    out.push(line);
  }
  const missing = services.filter((s) => !pinned.has(s));
  if (missing.length) throw new Error(`No image line to pin for: ${missing.join(", ")}`);
  const body = out.join("\n").replaceAll("./docker/Caddyfile:", "./Caddyfile:").replace(/^(#[^\n]*\n)+/, "");
  return `# Spine ${version}'s self-hosted stack. ./install.sh sets it up and starts it.\n${body}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) {
    console.error("Usage: release-compose.mjs <version>");
    process.exit(1);
  }
  process.stdout.write(releaseCompose(readFileSync(new URL("../../docker-compose.yml", import.meta.url), "utf8"), version));
}
