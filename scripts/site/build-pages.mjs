// US-SITE-14 (D-273) — the public site as Cloudflare serves it (D-274): the home
// page (apps/site) at the root and the docs (apps/docs) under /docs/, in one
// folder, apps/site/dist. The docs' build checks its own links; this then
// checks the home page's (US-SITE-02, D-275): every site link lands on a page
// that was built, and every #anchor on an element of the page it points at.
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

/** The file a site path is served from, the way Cloudflare's assets resolve it. */
const fileFor = (path) => join(dist, path, path.endsWith("/") ? "index.html" : "");
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id));

const broken = [];
for (const page of pages(dist)) {
  const html = readFileSync(page, "utf8");
  const pagePath = page.slice(dist.length).replace(/index\.html$/, "");
  for (const [, href] of html.matchAll(/href="((?:\/|#)[^"]*)"/g)) {
    if (href.startsWith("//") || /\.(svg|css|js|woff2?|png|webp|ico)$/.test(href.split(/[?#]/)[0])) continue;
    const [path, anchor] = href.split("#");
    const target = fileFor(path || pagePath);
    if (!existsSync(target)) broken.push(`${pagePath} → ${href} (no page)`);
    else if (anchor && !ids(readFileSync(target, "utf8")).has(anchor)) broken.push(`${pagePath} → ${href} (no #${anchor} there)`);
  }
}
if (broken.length) {
  console.error(`The home page has links that go nowhere:\n  ${broken.join("\n  ")}`);
  process.exit(1);
}
console.log(`Built the home page and the docs into ${dist.slice(root.length + 1)}; every link from the home page is there.`);
