#!/usr/bin/env node
// Fails if any component in src/components lacks a matching *.a11y.test.tsx file.
// Ports packages/ui/scripts/check-a11y-coverage.mjs's same enforcement to this
// package — see CLAUDE.md's "@spine/ui" rules section and this package's own
// src/test/a11y.ts doc comment for why RNTL assertions replace axe-core here.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const componentsDir = fileURLToPath(new URL("../src/components", import.meta.url));
const files = readdirSync(componentsDir);

const components = files
  .filter((f) => f.endsWith(".tsx") && !f.endsWith(".a11y.test.tsx"))
  .map((f) => f.replace(/\.tsx$/, ""));

const testFiles = new Set(files.filter((f) => f.endsWith(".a11y.test.tsx")).map((f) => f.replace(/\.a11y\.test\.tsx$/, "")));

const missing = components.filter((name) => !testFiles.has(name));

if (missing.length > 0) {
  console.error(`Missing a11y test coverage for ${missing.length} component(s) in packages/ui-native/src/components/:\n`);
  for (const name of missing) {
    console.error(`  - ${name}.tsx  (expected ${name}.a11y.test.tsx)`);
  }
  console.error(
    "\nEvery @spine/ui-native component must ship with an *.a11y.test.tsx in the same change (see CLAUDE.md)."
  );
  process.exit(1);
}

console.log(`a11y test coverage OK: ${components.length}/${components.length} components covered.`);
