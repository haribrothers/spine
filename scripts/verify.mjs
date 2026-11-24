#!/usr/bin/env node
/**
 * `pnpm verify` — runs what CI runs, locally, before a PR is opened or
 * marked ready for review, so CI confirms a green branch instead of
 * discovering failures on paid Actions minutes.
 *
 * Steps, in CI's order: audit, lint, typecheck, unit, sites, integration, e2e. Stops at
 * the first failure and says how to pick up from there.
 *
 *   pnpm verify                     everything
 *   pnpm verify --from integration  resume at a step after fixing it
 *   pnpm verify --skip e2e          leave a step out (e.g. a mobile-only change)
 *
 * Needs the dev infrastructure (`pnpm dev:infra:up`): Postgres for the
 * integration and E2E databases (spine_test, spine_e2e — created and
 * migrated here if missing) and Maildev for the E2E email checks.
 */
import { spawnSync } from "node:child_process";
import { createConnection } from "node:net";

const STEPS = [
  // US-OPS-18: high or critical advisories in production dependencies, as CI checks.
  { name: "audit", command: "pnpm audit --prod --audit-level high" },
  { name: "lint", command: "pnpm turbo run lint" },
  { name: "typecheck", command: "pnpm turbo run typecheck" },
  { name: "unit", command: "pnpm turbo run test --filter=!@spine/e2e && pnpm test:scripts" },
  // US-SITE-01, US-SITE-14: the home page with the docs under /docs/, as Cloudflare publishes it (D-274), every internal link checked.
  // US-SITE-10: openapi.json is regenerated (commit the change if it moved).
  { name: "sites", command: "pnpm --filter @spine/api openapi ../docs/openapi.json && pnpm site:build" },
  { name: "integration", command: "pnpm --filter @spine/api test:integration", databases: ["spine_test"] },
  { name: "e2e", command: "pnpm --filter @spine/e2e test", databases: ["spine_e2e"], ports: [[1025, "Maildev"]] },
];

function option(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const from = option("--from");
const skip = new Set((option("--skip") ?? "").split(",").filter(Boolean));
for (const name of [from, ...skip].filter(Boolean)) {
  if (!STEPS.some((step) => step.name === name)) {
    console.error(`Unknown step "${name}". Steps: ${STEPS.map((step) => step.name).join(", ")}.`);
    process.exit(2);
  }
}
const steps = STEPS.slice(from ? STEPS.findIndex((step) => step.name === from) : 0).filter((step) => !skip.has(step.name));

function run(command, env = {}) {
  return spawnSync(command, { shell: true, stdio: "inherit", env: { ...process.env, ...env } }).status === 0;
}

function quiet(command) {
  const result = spawnSync(command, { shell: true, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function reachable(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });
}

const COMPOSE = "docker compose -f docker-compose.dev.yml";
const prepared = new Set();

/** Creates the scratch database if it's missing and applies migrations (the E2E web server migrates its own on start). */
function prepareDatabase(name) {
  if (prepared.has(name)) return true;
  const exists = quiet(`${COMPOSE} exec -T db psql -U spine -d spine -tAc "SELECT 1 FROM pg_database WHERE datname = '${name}'"`);
  if (exists === null) return false;
  if (exists !== "1" && !run(`${COMPOSE} exec -T db createdb -U spine ${name}`)) return false;
  prepared.add(name);
  return run("pnpm --filter @spine/api db:migrate", { DATABASE_URL: `postgres://spine:spine@localhost:5432/${name}` });
}

const timings = [];
for (const step of steps) {
  if (step.databases || step.ports) {
    if (!(await reachable(5432))) {
      console.error(`\n✗ ${step.name}: Postgres isn't running on 5432. Start it with \`pnpm dev:infra:up\`.`);
      process.exit(1);
    }
    for (const [port, label] of step.ports ?? []) {
      if (!(await reachable(port))) {
        console.error(`\n✗ ${step.name}: ${label} isn't running on ${port}. Start it with \`pnpm dev:infra:up\`.`);
        process.exit(1);
      }
    }
    for (const database of step.databases ?? []) {
      if (!prepareDatabase(database)) {
        console.error(`\n✗ ${step.name}: couldn't create or migrate ${database}.`);
        process.exit(1);
      }
    }
  }
  console.log(`\n▶ ${step.name}: ${step.command}`);
  const started = Date.now();
  const ok = run(step.command);
  timings.push(`${step.name} ${((Date.now() - started) / 60000).toFixed(1)} min`);
  if (!ok) {
    console.error(`\n✗ ${step.name} failed. Fix it, then run \`pnpm verify --from ${step.name}\`.`);
    process.exit(1);
  }
}

console.log(`\n✓ verify passed — ${timings.join(" · ")}`);
