import { execFileSync } from "node:child_process";
import { join } from "node:path";

const scripts = join(__dirname, "../../../../packages/ui-native/scripts");

/** US-MOB-21 — every @spine/ui-native component has a doc screen and an a11y test; `pnpm --filter @spine/ui-native test` fails otherwise. */
describe("US-MOB-21 · document every native component in a showcase app", () => {
  for (const script of ["check-doc-coverage.mjs", "check-a11y-coverage.mjs"]) {
    it(`${script} passes`, () => {
      const output = execFileSync(process.execPath, [join(scripts, script)], { encoding: "utf8" });
      expect(output).toMatch(/OK: (\d+)\/\1 components/);
    });
  }
});
