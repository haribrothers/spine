import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const { version } = JSON.parse(read("package.json"));

/** Where a stranger reads how to download Spine: the README and the docs' two install pages. */
const PAGES = ["README.md", "apps/docs/src/content/docs/self-hosting/install.md", "apps/docs/src/content/docs/get-started/install.md"];
/** What an install needs from a release (the release workflow publishes them, US-OPS-51). The routing is in the spine-proxy image (D-280), so no Caddyfile. */
const FILES = ["install.sh", "backup.sh", "restore.sh", "upgrade.sh", "docker-compose.yml", "env.example"];

describe("US-OPS-19 · the README gets a stranger to an install", () => {
  it("downloads this version's files by name, with nothing to install or sign in to (GitHub's latest release skips betas)", () => {
    for (const page of PAGES) {
      const text = read(page);
      assert.ok(text.includes(`v=v${version}\n`), `${page} downloads v${version}`);
      assert.ok(text.includes('curl -fsSLO "https://github.com/haribrothers/spine/releases/download/$v/$f"'), `${page} downloads each file with curl`);
    }
    // The home page's install commands (US-SITE-02) are the same, one per line.
    const home = read("apps/site/src/locales/en/home.ts");
    assert.ok(home.includes(`"v=v${version}"`), `the home page downloads v${version}`);
    assert.ok(home.includes('curl -fsSLO "https://github.com/haribrothers/spine/releases/download/$v/$f"'), "the home page downloads each file with curl");
    for (const file of FILES) assert.ok(home.includes(` ${file}`), `the home page downloads ${file}`);
    assert.doesNotMatch(home, /gh release download/, "the home page doesn't use gh, which needs signing in and skips betas");
  });

  it("lists every file an install needs, and the release workflow publishes each of them", () => {
    const workflow = read(".github/workflows/release.yml");
    for (const page of PAGES) {
      const text = read(page);
      for (const file of FILES) assert.ok(text.includes(`\`${file}\``), `${page} lists ${file}`);
    }
    for (const file of ["env.example", "docker-compose.yml", "install.sh"]) assert.ok(workflow.includes(file), `the release publishes ${file}`);
  });

  it("downloads no Caddyfile: the proxy image carries Spine's routing (D-280), though releases still publish it for upgrade.sh from before it", () => {
    for (const page of [...PAGES, "apps/site/src/locales/en/home.ts"]) {
      const loop = /for f in ([^;]+);/.exec(read(page));
      assert.ok(loop, `${page} has the download loop`);
      assert.doesNotMatch(loop[1], /Caddyfile/, `${page} doesn't download the Caddyfile`);
    }
    assert.match(read(".github/workflows/release.yml"), /cp docker\/Caddyfile dist\//);
  });

  it("says how Spine opens on your network, on another port and with a domain (D-279)", () => {
    for (const page of PAGES) {
      const text = read(page);
      assert.ok(text.includes("http://localhost:7746"), `${page} gives the address on this computer`);
      assert.match(text, /http:\/\/<its IP address>:7746/, `${page} gives the address from other devices`);
      assert.ok(text.includes("--port 8080"), `${page} says how to use another port`);
      assert.ok(text.includes("--app-url https://spine.example.com"), `${page} says how to install with a domain`);
    }
  });
});
