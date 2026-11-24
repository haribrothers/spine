import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * US-OPS-10 (D-058) — every confirmation in the web app is styled by what
 * it does: `variant="danger"` exactly when it deletes, voids, deactivates
 * or removes; primary (the default) otherwise.
 */
const webSrc = path.resolve(__dirname, "../../../web/src");
/** US-OPS-16: labels are `t("key")` calls; read them as the English they show. */
const en = JSON.parse(readFileSync(path.resolve(__dirname, "../../../../packages/shared/src/i18n/en.json"), "utf8")) as Record<string, unknown>;
function english(src: string): string {
  return src.replace(/\bt\(\s*"([^"]+)"[^)]*\)/g, (call, key: string) => {
    const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);
    return typeof value === "string" ? value : call;
  });
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : full.endsWith(".tsx") ? [full] : [];
  });
}

/** Each `<AlertDialogAction …>…</AlertDialogAction>` with its opening tag and label. */
function actions(): { file: string; tag: string; label: string }[] {
  const found: { file: string; tag: string; label: string }[] = [];
  for (const file of files(webSrc)) {
    const src = english(readFileSync(file, "utf8"));
    for (const m of src.matchAll(/<AlertDialogAction\b([\s\S]*?)<\/AlertDialogAction>/g)) {
      const body = m[1]!;
      // The opening tag ends at the first ">" that isn't part of "=>".
      const end = body.search(/(?<!=)>/);
      found.push({ file: path.relative(webSrc, file), tag: body.slice(0, end), label: body.slice(end + 1).replace(/\s+/g, " ").trim() });
    }
  }
  return found;
}

const DESTRUCTIVE = /\b(delete|void|remove|deactivate)\b/i;

describe("US-OPS-10 · confirmations are styled by what they do", () => {
  const all = actions();

  it("finds the app's confirmations", () => {
    expect(all.length).toBeGreaterThan(25);
  });

  it("delete, void, remove and deactivate confirmations are danger", () => {
    const missing = all.filter((a) => DESTRUCTIVE.test(`${a.tag} ${a.label}`) && !/variant=/.test(a.tag) && !a.label.includes("All events"));
    expect(missing.map((a) => `${a.file}: ${a.label}`)).toEqual([]);
  });

  it("nothing else is danger", () => {
    const wrong = all.filter((a) => /variant="danger"/.test(a.tag) && !DESTRUCTIVE.test(`${a.tag} ${a.label}`));
    expect(wrong.map((a) => `${a.file}: ${a.label}`)).toEqual([]);
  });

  it("'All events' is primary for edits and danger only when deleting the series; 'Create invoice' is primary", () => {
    const allEvents = all.find((a) => a.label.includes("All events"))!;
    expect(allEvents.tag).toContain('variant={action === "delete" ? "danger" : "primary"}');
    // Billing an expense asks through useConfirm() on its page (US-PUR-43); it stays primary.
    const page = english(readFileSync(path.join(webSrc, "app/(app)/expenses/expense-detail.tsx"), "utf8"));
    const createInvoice = page.slice(page.lastIndexOf("confirm({", page.indexOf("confirmLabel: Create invoice")), page.indexOf("confirmLabel: Create invoice"));
    expect(createInvoice).toContain("Bill this expense to the customer?");
    expect(createInvoice).not.toContain("variant");
  });
});
