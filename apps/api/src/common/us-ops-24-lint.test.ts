import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/**
 * US-OPS-24 — the lint rule that keeps money going through `formatMoney`:
 * it fails on hand-joined amounts and currency codes in the web app.
 */
const webRoot = path.resolve(__dirname, "../../../web");
const eslint = new ESLint({ cwd: webRoot, overrideConfigFile: path.join(webRoot, "eslint.config.js") });

async function moneyErrors(code: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath: path.join(webRoot, "src/app/(app)/example/example.tsx") });
  return result!.messages.filter((m) => m.message.includes("D-089")).length;
}

describe("US-OPS-24 · the money lint rule", () => {
  it("fails on `${amount} ${currency}` in a template string", async () => {
    expect(await moneyErrors("export const label = (amount: string, currency: string) => `${amount} ${currency}`;\n")).toBe(1);
    expect(await moneyErrors("export const label = (row: { total: string; currency: string }) => `${row.total} ${row.currency}`;\n")).toBe(1);
  });

  it("fails on {amount} {currency} in JSX", async () => {
    expect(await moneyErrors("export const Total = ({ amount, currency }: { amount: string; currency: string }) => (\n  <span>\n    {amount} {currency}\n  </span>\n);\n")).toBe(1);
  });

  it("fails on importing toDecimalString to show an amount", async () => {
    expect(await moneyErrors('import { toDecimalString } from "@spine/shared/money";\nexport const x = toDecimalString;\n')).toBe(1);
  });

  it("passes formatMoney, and a currency passed as a prop", async () => {
    expect(
      await moneyErrors(
        'import { formatMoney } from "../../../lib/money";\nexport const Total = ({ amount, currency }: { amount: string; currency: string }) => (\n  <span data-currency={currency}>{formatMoney(amount, currency)}</span>\n);\n',
      ),
    ).toBe(0);
  });
});
