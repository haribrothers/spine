import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "../tests/fixtures";
import type { Page } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const lists = join(__dirname, "../../docs/screenshots");
const out = join(__dirname, "../../docs/src/assets/screens");

interface Shot {
  id: string;
  path: string;
  alt: string;
  click?: string;
  wait?: string;
}

/** A demo record of each kind, for the {placeholders} in a path. */
const RECORDS: Record<string, string> = {
  contact: "/contacts",
  quote: "/quotes",
  invoice: "/invoices",
  job: "/jobs",
  payment: "/payments",
  creditNote: "/credit-notes",
  expense: "/expenses",
  vendorBill: "/vendor-bills",
  vendorCredit: "/vendor-credits",
  vendorPayment: "/vendor-payments",
  bankAccount: "/money-accounts",
  team: "/org/teams",
  journal: "/manual-journals",
};

async function firstId(page: Page, path: string): Promise<string | null> {
  const res = await page.request.get(`${API_URL}${path}`);
  if (!res.ok()) return null;
  const body = (await res.json()) as unknown;
  const rows = Array.isArray(body) ? body : ((body as { items?: unknown[] }).items ?? (body as { data?: unknown[] }).data ?? []);
  return (rows[0] as { id?: string } | undefined)?.id ?? null;
}

/** Saves the capture only if the screen reached the state its caption describes; otherwise the page keeps the caption. */
async function capture(page: Page, shot: Shot, theme: "light" | "dark", ids: Record<string, string | null>, file: string): Promise<boolean> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  const path = shot.path.replace(/\{(\w+)\}/g, (_, key: string) => ids[key] ?? `{${key}}`);
  await page.goto(path);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  if (shot.click) {
    const target = page.getByRole("button", { name: shot.click }).or(page.getByRole("tab", { name: shot.click })).or(page.getByRole("link", { name: shot.click })).first();
    const pressed = await target.click({ timeout: 5_000 }).then(() => true, () => false);
    if (!pressed) {
      console.warn(`${shot.id}: couldn't press "${shot.click}"; not captured`);
      return false;
    }
  }
  if (shot.wait) {
    const shown = await page.getByText(shot.wait).first().waitFor({ timeout: 10_000 }).then(() => true, () => false);
    if (!shown) {
      console.warn(`${shot.id}: "${shot.wait}" didn't show; not captured`);
      return false;
    }
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: file, animations: "disabled", caret: "hide" });
  return true;
}

test("US-SITE-06 · capture the guide's screens in light and dark mode", async ({ page, seededOrg: _ }) => {
  mkdirSync(out, { recursive: true });
  const ids: Record<string, string | null> = {};
  for (const [key, list] of Object.entries(RECORDS)) ids[key] = await firstId(page, list);
  const shots = readdirSync(lists)
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => JSON.parse(readFileSync(join(lists, name), "utf8")) as Shot[]);
  for (const shot of shots) {
    if (/\{(\w+)\}/.test(shot.path.replace(/\{(\w+)\}/g, (m, key: string) => (ids[key] ? "" : m)))) {
      console.warn(`${shot.id}: no demo record for ${shot.path}; skipped`);
      continue;
    }
    for (const theme of ["light", "dark"] as const) if (!(await capture(page, shot, theme, ids, join(out, `${shot.id}-${theme}.webp`)))) break;
  }
});
