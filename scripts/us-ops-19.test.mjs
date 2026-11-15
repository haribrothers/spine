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
  it("downloads this version's files by name, with nothing to install or sign in to (GitHub's latest release skips betas)", () => {
    for (const page of PAGES) {
      const text = read(page);
      assert.ok(text.includes(`v=v${version}\n`), `${page} downloads v${version}`);
      assert.ok(text.includes('curl -fsSLO "https://github.com/haribrothers/spine/releases/download/$v/$f"'), `${page} downloads each file with curl`);
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
