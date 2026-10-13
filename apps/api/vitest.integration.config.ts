import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";
import { integrationWorkers } from "./src/test-utils/integration-databases";

const workers = integrationWorkers();

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
    // D-239: files run in parallel, each worker against its own copy of the
    // test database (made before the run, dropped after), so no file sees
    // another's rows — ledger-integrity's TRUNCATE empties only its worker's
    // copy. One shared database made them run one at a time before.
    // SPINE_TEST_WORKERS sets how many (2 in CI, 4 locally).
    pool: "forks",
    poolOptions: { forks: { minForks: 1, maxForks: workers } },
    fileParallelism: workers > 1,
    globalSetup: ["./src/test-utils/integration-global-setup.ts"],
    setupFiles: ["./src/test-utils/integration-worker-db.ts"],
  },
});
