#!/usr/bin/env node
// US-OPS-51 (D-262) — the release's version is the root package.json's, and
// the tag must say the same: `v1.0.0` or `v1.0.0-beta.1`. Prints the version
// and whether it's a pre-release; in GitHub Actions also writes them to
// $GITHUB_OUTPUT. Exits 1, naming both, when they differ.
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

/** @returns {{ version: string, prerelease: boolean }} */
export function releaseVersion(tag, packageVersion) {
  if (!SEMVER.test(packageVersion ?? "")) throw new Error(`The root package.json version "${packageVersion}" isn't a version like 1.0.0 or 1.0.0-beta.1.`);
  if (tag !== `v${packageVersion}`) throw new Error(`The tag ${tag} doesn't match the root package.json version ${packageVersion}. Tag v${packageVersion}, or change the version first.`);
  return { version: packageVersion, prerelease: packageVersion.includes("-") };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
  const root = new URL("../../package.json", import.meta.url);
  try {
    const { version, prerelease } = releaseVersion(tag, JSON.parse(readFileSync(root, "utf8")).version);
    console.log(`version=${version}\nprerelease=${prerelease}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nprerelease=${prerelease}\n`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
