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
    swc.vite({ module: { type: "es6" } }),
  ],
  test: {
    include: ["**/*.integration.test.ts"],
  },
});
