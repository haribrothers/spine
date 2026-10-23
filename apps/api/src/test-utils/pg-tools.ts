import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * pg_dump / pg_restore for tests: the ones on the PATH (CI's runner has
 * PostgreSQL 16's), or else the local Docker database's own, run inside its
 * container (`pnpm dev:infra:up` names it spine-dev-db-1).
 */
export function pgTool(name: "pg_dump" | "pg_restore"): string {
  try {
    execFileSync(name, ["--version"], { stdio: "ignore" });
    return name;
  } catch {
    const dir = mkdtempSync(join(tmpdir(), `spine-${name}-`));
    const wrapper = join(dir, name);
    writeFileSync(wrapper, `#!/bin/sh\nexec docker exec -i spine-dev-db-1 ${name} "$@"\n`);
    chmodSync(wrapper, 0o755);
    return wrapper;
  }
}
