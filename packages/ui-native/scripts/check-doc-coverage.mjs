#!/usr/bin/env node
/**
 * US-MOB-21 — every @spine/ui-native component has a doc screen: a demo in
 * apps/showcase-native (src/components/demos/<name>-demo.tsx, listed in its
 * catalog). (apps/design-system-native, the older doc app, was removed — D-240.)
 * Runs with `pnpm --filter @spine/ui-native test`, next to the a11y check.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const componentsDir = fileURLToPath(new URL("../src/components", import.meta.url));
const showcaseDemos = fileURLToPath(new URL("../../../apps/showcase-native/src/components/demos", import.meta.url));
const showcaseCatalog = fileURLToPath(new URL("../../../apps/showcase-native/src/lib/component-catalog.ts", import.meta.url));

const components = readdirSync(componentsDir)
  .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
  .map((f) => f.replace(/\.tsx$/, ""));

const catalog = existsSync(showcaseCatalog) ? readFileSync(showcaseCatalog, "utf8") : "";
const inShowcase = (name) => existsSync(`${showcaseDemos}/${name}-demo.tsx`) && catalog.includes(`slug: "${name}"`);

const missing = components.filter((name) => !inShowcase(name));

if (missing.length > 0) {
  console.error(`Missing a doc screen for ${missing.length} component(s) in packages/ui-native/src/components/:\n`);
  for (const name of missing) {
    console.error(`  - ${name}.tsx  (add apps/showcase-native/src/components/demos/${name}-demo.tsx and a catalog entry)`);
  }
  console.error("\nEvery @spine/ui-native component ships with its doc screen in the same change (US-MOB-21).");
  process.exit(1);
}

console.log(`doc screen coverage OK: ${components.length}/${components.length} components documented.`);
