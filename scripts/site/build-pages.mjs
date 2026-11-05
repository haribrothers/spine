// US-SITE-14 (D-273) — the public site as Cloudflare Pages serves it: the home
// page (apps/site) at the root and the docs (apps/docs) under /docs/, in one
// folder, apps/site/dist. Each build checks its own links; this then checks
// the home page's links into /docs/ land on a page the docs built.
//   pnpm site:build
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const dist = join(root, "apps/site/dist");

const run = (command) => execSync(command, { cwd: root, stdio: "inherit" });
// The home page first: its build empties apps/site/dist, then the docs build into dist/docs.
run("pnpm --filter @spine/site build");
run("pnpm --filter @spine/docs build:pages");

/** Every HTML file under a folder. */
function pages(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "docs" && dir === dist ? [] : pages(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

const broken = [];
for (const page of pages(dist)) {
  for (const [, href] of readFileSync(page, "utf8").matchAll(/href="(\/docs\/[^"#?]*)/g)) {
    const target = join(dist, href, href.endsWith("/") ? "index.html" : "");
    if (!existsSync(target)) broken.push(`${page.slice(dist.length)} → ${href}`);
  }
}
if (broken.length) {
  console.error(`The home page links to docs pages that weren't built:\n  ${broken.join("\n  ")}`);
  process.exit(1);
}
console.log(`Built the home page and the docs into ${dist.slice(root.length + 1)}; every link into /docs/ is there.`);
