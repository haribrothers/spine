// US-OPS-51 — publish a release with one tag. Run: pnpm test:scripts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { releaseCompose } from "./release-compose.mjs";
import { releaseVersion } from "./version.mjs";

describe("US-OPS-51 · publish a release with one tag", () => {
  it("a tag that matches the root package.json version is a release; one with a suffix is a pre-release", () => {
    assert.deepEqual(releaseVersion("v1.0.0", "1.0.0"), { version: "1.0.0", prerelease: false });
    assert.deepEqual(releaseVersion("v1.0.0-beta.1", "1.0.0-beta.1"), { version: "1.0.0-beta.1", prerelease: true });
  });

  it("a tag that doesn't match fails, naming both", () => {
    assert.throws(() => releaseVersion("v1.0.1", "1.0.0"), /tag v1\.0\.1 doesn't match the root package\.json version 1\.0\.0/);
    assert.throws(() => releaseVersion("v0.0.0", "0.0"), /isn't a version/);
  });

  it("the root package.json carries the product version", () => {
    const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    assert.match(version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });

  it("the published Compose file pulls that version's images and builds nothing", () => {
    const compose = readFileSync(new URL("../../docker-compose.yml", import.meta.url), "utf8");
    const published = releaseCompose(compose, "1.0.0-beta.1");
    assert.match(published, /^ {4}image: ghcr\.io\/haribrothers\/spine-api:1\.0\.0-beta\.1$/m);
    assert.match(published, /^ {4}image: ghcr\.io\/haribrothers\/spine-web:1\.0\.0-beta\.1$/m);
    assert.doesNotMatch(published, /^\s+build:/m);
    assert.doesNotMatch(published, /dockerfile:/);
    // Everything else is the repo's own file.
    assert.match(published, /healthcheck:/);
    assert.match(published, /image: postgres:16-alpine/);
    // A release's files sit side by side.
    assert.match(published, /- \.\/Caddyfile:\/etc\/caddy\/Caddyfile/);
  });
});
