import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

let cached: string | undefined;

/**
 * The product version (D-262): the root package.json's, found by walking up
 * from this file — in the repo, and in the API image (/repo/package.json).
 */
export function spineVersion(): string {
  if (cached) return cached;
  let dir = __dirname;
  for (;;) {
    const file = join(dir, "package.json");
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, "utf8")) as { name?: string; version?: string };
      if (pkg.name === "spine" && pkg.version) return (cached = pkg.version);
    }
    const parent = dirname(dir);
    if (parent === dir) return (cached = "0.0.0");
    dir = parent;
  }
}
