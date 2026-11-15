import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const { version } = JSON.parse(read("package.json"));

/** Where a stranger reads how to download Spine: the README and the docs' two install pages. */
const PAGES = ["README.md", "apps/docs/src/content/docs/self-hosting/install.md", "apps/docs/src/content/docs/get-started/install.md"];
/** What an install needs from a release (the release workflow publishes them, US-OPS-51). */
const FILES = ["install.sh", "backup.sh", "restore.sh", "upgrade.sh", "docker-compose.yml", "Caddyfile", "env.example"];

describe("US-OPS-19 · the README gets a stranger to an install", () => {
  it("names this version's tag in the download command, since without one gh finds no release while there are only betas", () => {
    for (const page of PAGES) {
      assert.ok(read(page).includes(`gh release download v${version} --repo haribrothers/spine`), `${page} downloads v${version}`);
    }
  });

  it("lists every file an install needs, and the release workflow publishes each of them", () => {
    const workflow = read(".github/workflows/release.yml");
    for (const page of PAGES) {
      const text = read(page);
      for (const file of FILES) assert.ok(text.includes(`\`${file}\``), `${page} lists ${file}`);
    }
    for (const file of ["Caddyfile", "env.example", "docker-compose.yml", "install.sh"]) assert.ok(workflow.includes(file), `the release publishes ${file}`);
  });

  it("says how to install on your own computer", () => {
    for (const page of PAGES) assert.ok(read(page).includes("--app-url http://localhost"), `${page} explains a local install`);
  });
});
