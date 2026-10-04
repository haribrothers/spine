import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    // Vitest's default esbuild transform doesn't emit emitDecoratorMetadata
    // output, which NestJS's DI relies on for parameterless-typed
    // constructor injection (e.g. `Reflector` with no explicit `@Inject`) —
    // without this, Test.createTestingModule (members.http.integration.test.ts,
    // the first file to boot a real Nest app under Vitest) fails with
    // "Nest can't resolve dependencies" even though the exact same code
    // boots fine under `nest build`'s real tsc compilation. Standard fix
    // per NestJS's own Vitest testing docs.
    // Automatic JSX runtime, as in the Nest build: the PDF templates are TSX
    // and never import React themselves.
    swc.vite({ module: { type: "es6" }, jsc: { transform: { react: { runtime: "automatic" } } } }),
  ],
  test: {
    include: ["**/*.integration.test.ts"],
    // Every file shares one database, and ledger-integrity TRUNCATEs
    // `organization ... CASCADE` — run in parallel, files deleted each
    // other's orgs mid-test (FK violations, deadlocks, "too many clients").
    fileParallelism: false,
  },
});
