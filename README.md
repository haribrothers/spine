# Spine

Spine is a self-hosted business management app for small service and project
businesses — construction and interiors, fabrication, electrical/plumbing
contractors, AMC and maintenance firms, design studios. It follows the
workflow a small business actually runs on:

**enquiry → quote → job → invoice → payment → books**

Double-entry accounting is derived automatically from business events
(an invoice issued, a payment received) rather than typed in by the user —
the owner never has to think in debits and credits. See
[`docs/spine-prd.md`](docs/spine-prd.md) for the full product spec, and
[`CLAUDE.md`](CLAUDE.md) for the architecture rules that govern implementation.

## Status

Phase 0 (Foundation) is complete — monorepo scaffold, auth, the `@spine/ui`
component library and its docs app, the ledger/money/tax core, onboarding,
Settings, and Files. Phase 1 (Sales Spine) is underway: Contacts & CRM,
Catalogue, and Quotes (including PDF rendering, email sending, and the
public accept/reject link) are complete, plus an in-app notification centre
and browser push notifications. See [`CHANGELOG.md`](CHANGELOG.md) for the
full phase-by-phase breakdown of what's landed vs. planned.

## Tech stack

| Layer | Choice |
|---|---|
| Web | Next.js (App Router), TypeScript |
| API | NestJS, REST + OpenAPI |
| Database | PostgreSQL 16 via Drizzle ORM |
| Styling | Tailwind CSS v4 |
| Components | `@spine/ui` — Radix UI primitives, themeable |
| Mobile | React Native via Expo |
| Auth | Better Auth |
| Jobs | pg-boss (Postgres-backed queue) |
| Files | S3-compatible (MinIO for self-hosting) |
| Monorepo | Turborepo + pnpm |
| Container | Docker Compose |

Full rationale for each choice is in PRD §5.

## Repository layout

```
spine/
├─ apps/
│  ├─ api/            # NestJS — REST API, Drizzle schema & migrations
│  ├─ web/            # Next.js
│  ├─ design-system/  # @spine/ui's living docs app (component pages, not Storybook)
│  └─ mobile/         # Expo (not yet scaffolded)
├─ packages/
│  ├─ shared/     # money, tax engine, zod schemas, shared types
│  ├─ ui/         # @spine/ui — Radix + Tailwind component library
│  └─ config/     # shared eslint, tsconfig, tailwind presets
├─ docker/        # Dockerfile.api, Dockerfile.web, Caddyfile (production)
├─ docs/          # spine-prd.md — the product spec; DESIGN.md — the design system spec
├─ scripts/       # seed.ts
├─ docker-compose.yml       # production stack (builds api/web, runs behind Caddy)
├─ docker-compose.dev.yml   # local dev infra only (Postgres, MinIO, MailDev)
└─ .env.example
```

## Local development setup

This is the path for contributors working on Spine itself. (If you just
want to run Spine as a self-hosted app, see [Production / self-hosting](#production--self-hosting)
below instead — that path never requires Node or pnpm on the host.)

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/installation) (`corepack enable` is the easiest way to get the pinned version)
- Docker (for Postgres, MinIO, and MailDev — you do not need any of these installed locally)

### 1. Clone and install

```bash
git clone <repo-url> spine
cd spine
pnpm install
```

### 2. Start local infrastructure (Postgres + MinIO)

```bash
pnpm dev:infra:up
```

This starts three containers via `docker-compose.dev.yml`, separate from the
production stack in `docker-compose.yml`:

- **Postgres** on `localhost:5432` (user/pass/db: `spine`/`spine`/`spine`)
- **MinIO** on `localhost:9000` (API) and `localhost:9001` (console; login `spine` / `spinespine`)
- **MailDev** on `localhost:1025` (SMTP) and `localhost:1080` (web UI — read quote emails here instead of a real inbox; nothing is ever actually delivered). Optional — leave `SMTP_HOST` blank in `.env` and email sending degrades gracefully (the quote still issues, the email queues for retry) if you don't need to see it locally.

Data persists in Docker volumes (`spine-dev_spine_dev_pgdata`,
`spine-dev_spine_dev_minio`) across restarts. Useful commands:

```bash
pnpm dev:infra:down    # stop containers, keep data
pnpm dev:infra:reset   # wipe volumes and start clean — use after a schema reset
pnpm dev:infra:logs    # tail container logs
```

### 3. Configure environment

```bash
cp .env.development.example .env
```

The development example points `DATABASE_URL` at `localhost:5432`, since
`apps/api` and `apps/web` run natively on your machine during development —
not inside Docker. (`.env.example`, by contrast, uses the Docker network
hostname `db:5432` and is for the production compose stack — see below.)

Everything besides the three required variables (`DATABASE_URL`,
`AUTH_SECRET`, `APP_URL`) is optional and degrades gracefully when left
blank — including `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, which enable
browser push notifications (S-10.12). To test push locally, generate a
keypair and paste both values in:

```bash
npx web-push generate-vapid-keys
```

### 4. Run migrations and seed data

```bash
pnpm db:migrate:dev
pnpm db:seed:dev
```

The seed script creates a demo organisation and populates the default chart
of accounts (PRD §14.2).

### 5. Start the apps

```bash
pnpm dev
```

This runs `apps/api`, `apps/web`, and `apps/design-system` in parallel via
Turborepo, with hot-reload.

- API health check: `http://localhost:4000/health`
- Web: `http://localhost:3000`
- Design system docs (the `@spine/ui` component library's living spec — props,
  usage examples, one page per component, not Storybook): `http://localhost:3100`

To run just one of these (e.g. only the API while you work on a script),
use `pnpm --filter @spine/api dev` instead.

### Everyday commands

Run from the repo root, applied across every package via Turborepo:

```bash
pnpm build       # build all apps/packages
pnpm lint        # eslint across the workspace
pnpm typecheck   # tsc --noEmit across the workspace
pnpm test        # unit tests (no database required)
```

Database-specific, scoped to `apps/api`:

```bash
pnpm --filter @spine/api db:generate       # generate a new migration from schema changes
pnpm --filter @spine/api db:migrate        # apply pending migrations
pnpm --filter @spine/api db:studio         # open Drizzle Studio against your dev DB
pnpm --filter @spine/api test:integration  # ledger-integrity tests — requires dev infra running
```

Schema lives in `apps/api/src/db/schema/`; after changing it, run
`db:generate` to produce a migration file in `apps/api/drizzle/`, review the
generated SQL, then `db:migrate` to apply it.

### Resetting your local database

If migrations get into a bad state or you want a completely clean slate:

```bash
pnpm dev:infra:reset
pnpm db:migrate:dev
pnpm db:seed:dev
```

## Production / self-hosting

The production path uses `docker-compose.yml`, which builds `api` and `web`
as containers and serves everything behind Caddy — no Node or pnpm needed on
the host.

```bash
cp .env.example .env      # edit the 3 required values
docker compose --profile minimal up -d
docker compose exec api pnpm --filter @spine/api db:migrate
```

The app boots with only three required environment variables
(`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`) — see PRD §6.8. Use the `full`
profile instead of `minimal` to also run MinIO and an optional Cloudflare
Tunnel sidecar.

The `db:migrate` step is currently manual (run it once after the first
`up`, and again after pulling any update that adds a migration) — a
one-command install script (S-10.7) and automatic migrate-on-upgrade
(S-10.9) are planned for Phase 6, once the rest of the product exists to
install. `scripts/backup.sh`/`restore.sh` (S-10.8) don't exist yet either;
until Phase 6, back up by running `pg_dump` against the `db` container and
copying the MinIO/S3 bucket contents yourself.

## Architecture notes worth knowing before contributing

These are enforced, not just conventions — see `CLAUDE.md` for the complete
list:

- **The ledger is derived, never authored.** Business events flow through a
  domain service → posting rule → balanced journal entry. Nobody types a
  journal entry by hand.
- **Journal entries are immutable.** In the database, not just by
  convention — Postgres triggers reject any `UPDATE`/`DELETE` on
  `journal_entries` or `journal_lines` after insert, and a deferred
  constraint trigger rejects any entry where debits ≠ credits at commit
  time. Corrections are reversing entries.
- **Money is `bigint` minor units + currency code.** Never floats.

## License

Not yet decided.
