// US-SITE-02 (D-275) — the home page, checked on what the build writes: the
// headline and buttons, the workflow, the product view in both themes, the
// six feature cards, the footer, motion that respects reduced motion, and an
// example job whose figures add up. Run: pnpm test:scripts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { home } from "../apps/site/src/locales/en/home.ts";

const root = new URL("..", import.meta.url).pathname;
const site = join(root, "apps/site");
const read = (p) => readFileSync(join(root, p), "utf8");
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ");
const cents = (s) => Math.round(Number(String(s).replace(/[^0-9.\-−]/g, "").replace("−", "-")) * 100);

let out;
let page;
let notFound;

describe("US-SITE-02 · a home page for people discovering Spine", () => {
  before(() => {
    // Inside the site's (ignored) .astro folder: Astro moves files into the output, which fails across disks.
    mkdirSync(join(site, ".astro"), { recursive: true });
    out = mkdtempSync(join(site, ".astro", "us-site-02-"));
    execFileSync("pnpm", ["theme"], { cwd: site, stdio: "pipe" });
    execFileSync("pnpm", ["exec", "astro", "build", "--outDir", out], { cwd: site, stdio: "pipe" });
    page = readFileSync(join(out, "index.html"), "utf8");
    notFound = readFileSync(join(out, "404.html"), "utf8");
  });
  after(() => out && rmSync(out, { recursive: true, force: true }));

  it("opens with the headline, the description and the two buttons", () => {
    const words = text(page);
    assert.ok(words.includes("Run your service business from one place"));
    assert.ok(words.includes(home.hero.lede));
    assert.match(page, /<a class="btn btn-p" href="\/docs\/get-started\/install\/"[^>]*>Install in 5 minutes/);
    assert.match(page, /<a class="btn btn-s" href="\/docs\/guide\/"[^>]*>Read the user guide/);
  });

  it("reads Enquiry → Quote → Job → Invoice → Payment → Books", () => {
    assert.match(page, /<ol class="track" aria-label="Enquiry → Quote → Job → Invoice → Payment → Books"/);
    const track = page.slice(page.indexOf('<ol class="track"'), page.indexOf("</ol>"));
    const steps = [...track.matchAll(/<span class="lbl"[^>]*>([^<]+)</g)].map(([, s]) => s);
    assert.deepEqual(steps, ["Enquiry", "Quote", "Job", "Invoice", "Payment", "Books"]);
  });

  it("shows the product view in the reader's theme, from Spine's tokens", () => {
    assert.match(page, /role="img" aria-label="The Spine dashboard: /);
    const tokens = JSON.parse(read("packages/config/tokens.json")).color;
    const css = read("apps/site/src/styles/tokens.css");
    assert.ok(css.includes(`--primary: ${tokens.light.primary};`), "light primary");
    assert.match(css, new RegExp(`:root\\[data-theme='dark'\\] \\{[^}]*--primary: ${tokens.dark.primary};`), "dark primary under data-theme");
    // The switch and the docs share Starlight's key, so the choice carries across (D-100).
    assert.match(page, /localStorage\.getItem\("starlight-theme"\)/);
    for (const choice of ["auto", "light", "dark"]) assert.match(page, new RegExp(`data-theme-choice="${choice}"`));
    assert.ok(text(page).includes(home.app.greeting));
  });

  it("has the six feature cards, with a link to the developer docs", () => {
    const titles = [...page.matchAll(/<article class="tile[^"]*"[^>]*>\s*<div><h3>([^<]+)<\/h3>|<div class="dev"[^>]*>\s*<div[^>]*>\s*<h3>([^<]+)</g)].map(([, a, b]) => (a ?? b).replace(/&#39;/g, "'"));
    assert.deepEqual(titles, [
      "Quotes customers accept online",
      "Jobs, milestones and retention",
      "Invoices that post to the books",
      "A field app that works offline",
      "Self-hosted — your data stays yours",
      "Built for developers too",
    ]);
    assert.match(page, /href="\/docs\/developers\/architecture\/"/);
    assert.match(page, /href="\/docs\/api\/"/);
  });

  it("names the licence and links to older versions of the docs in the footer", () => {
    const footer = page.slice(page.indexOf('<footer class="ftr"'));
    assert.match(footer, /href="https:\/\/github\.com\/haribrothers\/spine\/blob\/main\/LICENSE"[^>]*>AGPL-3\.0 licence/);
    assert.match(footer, /href="\/docs\/versions\/"[^>]*>Older versions/);
  });

  it("has its own page for a missing address (US-SITE-14)", () => {
    assert.ok(text(notFound).includes(home.notFound.heading));
    assert.match(notFound, /href="\/docs\/"/);
  });

  it("moves only for readers who haven't asked for less motion, and never hides content without JavaScript", () => {
    const css = read("apps/site/src/styles/home.css");
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(read("apps/site/src/scripts/motion.ts"), /prefers-reduced-motion: reduce/);
    // Hidden-until-revealed states only apply once the script has marked the page as moving.
    for (const [, selector] of css.matchAll(/^([^{@/]*\[data-reveal\][^{]*)\{[^}]*opacity: 0/gm)) assert.match(selector, /\[data-motion='full'\]/);
    // Without the script the "How it works" story is the plain list.
    assert.match(page, /<section id="flow" class="flow" data-static="1"/);
  });

  it("takes every colour from the tokens: no hex values in the site's source", () => {
    const files = (dir) =>
      readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
    const offenders = files("apps/site/src")
      .filter((f) => /\.(astro|ts|css)$/.test(f) && !f.endsWith("styles/tokens.css"))
      .filter((f) => /#[0-9a-fA-F]{3,8}\b(?![\w-])/.test(read(f).replace(/href="#[^"]*"/g, "").replace(/`#\$\{[^}]+\}`/g, "")));
    assert.deepEqual(offenders, []);
  });

  it("tells one example job whose figures add up", () => {
    const { quote, invoice, payment, books } = home.flow;
    const quoteTotal = cents(quote.total[1]);
    assert.equal(quote.lines.reduce((s, [, v]) => s + cents(v), 0) + cents(quote.tax[1]), quoteTotal);
    const billed = cents(invoice.lines[0][1]);
    assert.equal(billed, Math.round(quoteTotal / 2));
    const retention = -cents(invoice.muted[1][1]);
    assert.equal(retention, Math.round(billed * 0.05));
    assert.equal(cents(invoice.total[1]), billed - retention);
    assert.equal(cents(payment.lines[0][1]), cents(invoice.total[1]));
    const debits = books.lines.reduce((s, l) => s + cents(l[2] || 0), 0);
    const credits = books.lines.reduce((s, l) => s + cents(l[3] || 0), 0);
    assert.equal(debits, credits);
    assert.equal(debits, billed);
    assert.equal(cents(books.total[2]), debits);
    assert.equal(cents(home.features.jobs.retentionValue), Math.round(quoteTotal * 0.05));
  });
});
