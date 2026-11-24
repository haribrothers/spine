// US-SITE-14 (D-273) — the public addresses are set once, in
// packages/shared/src/public-site.ts. Files that can't read it (the README,
// GitHub's issue template) spell them out and must agree; code never
// spells out the domain. Run: pnpm test:scripts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SPINE_DOCS_URL, SPINE_DOMAIN, SPINE_SITE_URL } from "../packages/shared/src/public-site.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("US-SITE-14 · the website's and docs' addresses", () => {
  it("the home page is spine.<domain> and the docs are under /docs/ on it", () => {
    assert.equal(SPINE_SITE_URL, `https://spine.${SPINE_DOMAIN}/`);
    assert.equal(SPINE_DOCS_URL, `https://spine.${SPINE_DOMAIN}/docs/`);
  });

  it("the README links to the docs at the configured address", () => {
    const readme = read("README.md");
    for (const page of ["", "guide/", "self-hosting/install/"]) assert.ok(readme.includes(`(${SPINE_DOCS_URL}${page})`), `README links to ${SPINE_DOCS_URL}${page}`);
  });

  it("GitHub's new-issue page points to the configured docs", () => {
    assert.match(read(".github/ISSUE_TEMPLATE/config.yml"), new RegExp(`url: ${SPINE_DOCS_URL.replace(/[./]/g, "\\$&")}\\n`));
  });

  it("no code spells out the domain: it reads it from public-site.ts", () => {
    const files = execFileSync("git", ["grep", "--untracked", "-l", "-F", SPINE_DOMAIN, "--", "apps", "packages", "scripts", ":!*.md"], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    });
    assert.deepEqual(files.split("\n").filter(Boolean), ["packages/shared/src/public-site.ts"]);
  });

  it("the Worker serves the folder pnpm site:build writes, with its 404 pages, branch previews and telemetry off (D-274)", () => {
    const config = JSON.parse(read("wrangler.jsonc").replace(/^\s*\/\/.*$/gm, ""));
    assert.equal(config.name, "spine-site");
    assert.equal(config.assets.directory, "./apps/site/dist");
    assert.match(read("scripts/site/build-pages.mjs"), /join\(root, "apps\/site\/dist"\)/);
    assert.equal(config.assets.not_found_handling, "404-page");
    assert.deepEqual(config.previews, {}, "a branch build runs `wrangler preview`, which needs a previews block");
    assert.equal(config.send_metrics, false);
    assert.ok(!read("wrangler.jsonc").includes(SPINE_DOMAIN), "wrangler.jsonc names no domain");
  });
});
