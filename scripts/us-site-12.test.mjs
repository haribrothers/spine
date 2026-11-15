import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** Whether `.dockerignore` keeps `path` out of the image's build context (the last matching rule wins, as Docker reads it). */
function ignored(path, rules) {
  let out = false;
  for (const raw of rules) {
    const negate = raw.startsWith("!");
    const pattern = negate ? raw.slice(1) : raw;
    const re = new RegExp(
      `^${pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*\//g, "\u0001")
        .replace(/\*\*/g, "\u0002")
        .replace(/\*/g, "[^/]*")
        .replace(/\u0001/g, "(?:.*/)?")
        .replace(/\u0002/g, ".*")}(?:/.*)?$`,
    );
    if (re.test(path)) out = !negate;
  }
  return out;
}

describe("US-SITE-12 · the web image builds the guide it serves offline", () => {
  const rules = read(".dockerignore")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  it("keeps the design tokens in the build context: the help's theme is generated from them", () => {
    // The web image runs `pnpm --filter @spine/docs build:help`, whose first step is this script.
    assert.match(read("docker/Dockerfile.web"), /pnpm --filter @spine\/docs build:help/);
    assert.match(read("scripts/site/tokens-css.mjs"), /"docs\/design\/tokens\.json"/);
    assert.equal(ignored("docs/design/tokens.json", rules), false, ".dockerignore must keep docs/design/tokens.json");
  });

  it("still leaves the rest of the spec, secrets and local data out", () => {
    for (const path of ["docs/prd/12-decisions.md", ".env", "apps/api/.data/files/x", "backups/spine-backup.tar.gz.enc", "apps/mobile/app.json"]) {
      assert.equal(ignored(path, rules), true, `${path} stays out of the image`);
    }
    assert.equal(ignored(".env.example", rules), false);
  });
});
