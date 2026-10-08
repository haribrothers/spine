import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const appRoot = join(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "test-utils" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}
const sources = [...sourceFiles(join(appRoot, "app")), ...sourceFiles(join(appRoot, "src"))];
const relative = (file: string) => file.replace(`${appRoot}/`, "");

describe("US-MOB-06 · keep financial reports off phones", () => {
  it("has no screens for invoices, payments, receivables, payables or reports", () => {
    const routes = sourceFiles(join(appRoot, "app")).map(relative);
    expect(routes.filter((route) => /invoice|payment|receivable|payable|report|credit-note|ledger/i.test(route))).toEqual([]);
  });

  it("never requests report, invoice or other money endpoints", () => {
    const FORBIDDEN = /["'`]\/(?:invoices|payments|credit-notes|reports|dashboard|ledger|journals|statements|vendor-bills|vendor-payments|bank|banking)\b/;
    expect(sources.filter((file) => FORBIDDEN.test(readFileSync(file, "utf8"))).map(relative)).toEqual([]);
  });

  it("shows money only for my own expenses (Today's card, Search, an expense, my queued expenses on Sync and Fix) — the quote being presented comes with US-MOB-16", () => {
    const formatsMoney = sources.filter((file) => /\bmoney\(/.test(readFileSync(file, "utf8")) && !file.endsWith("lib/format.ts")).map(relative).sort();
    expect(formatsMoney).toEqual([
      "src/features/expenses/expense-screen.tsx",
      "src/features/expenses/expenses-screen.tsx",
      "src/features/expenses/new-expense-screen.tsx",
      "src/features/search/search-screen.tsx",
      "src/features/sync/fix-screen.tsx",
      "src/features/today/today-screen.tsx",
      "src/lib/outbox/describe.ts",
    ]);
  });
});
