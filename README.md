# Spine

Spine is a self-hosted business management app for small service and project
businesses — construction and interiors, fabrication, electrical/plumbing
contractors, AMC and maintenance firms, design studios. It follows the
workflow a small business actually runs on:

**enquiry → quote → job → invoice → payment → books**

Double-entry accounting is derived automatically from business events
(an invoice issued, a payment received) rather than typed in by the user —
the owner never has to think in debits and credits. See
[`docs/README.md`](docs/README.md) for the full product spec, and
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
| Files | Local disk volume by default; any S3-compatible store optional (AWS S3, R2, B2, RustFS) |
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
├─ docs/          # product spec (README.md → prd/, features/, design/), progress.md, qa-script.md
├─ scripts/       # seed.ts
├─ docker-compose.yml       # production stack (builds api/web, runs behind Caddy)
├─ docker-compose.dev.yml   # local dev infra only (Postgres, MailDev; optional RustFS)
└─ .env.example
```

## Local development setup

This is the path for contributors working on Spine itself. (If you just
want to run Spine as a self-hosted app, see [Production / self-hosting](#production--self-hosting)
below instead — that path never requires Node or pnpm on the host.)

### Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/installation) (`corepack enable` is the easiest way to get the pinned version)
- Docker (for Postgres and MailDev — you do not need either installed locally)

### 1. Clone and install

```bash
git clone <repo-url> spine
cd spine
pnpm install
```

### 2. Start local infrastructure (Postgres + MailDev)

```bash
pnpm dev:infra:up
```

This starts two containers via `docker-compose.dev.yml`, separate from the
production stack in `docker-compose.yml`:

- **Postgres** on `localhost:5432` (user/pass/db: `spine`/`spine`/`spine`)
- **MailDev** on `localhost:1025` (SMTP) and `localhost:1080` (web UI — read quote emails here instead of a real inbox; nothing is ever actually delivered). Optional — leave `SMTP_HOST` blank in `.env` and email sending degrades gracefully (the quote still issues, the email queues for retry) if you don't need to see it locally.

The database persists in a Docker volume (`spine-dev_spine_dev_pgdata`)
across restarts. Uploaded files are stored by the local storage driver in
`apps/api/.data/files` (gitignored), so no storage container is needed. To
try the S3 driver, `COMPOSE_PROFILES=rustfs pnpm dev:infra:up` adds RustFS
on `localhost:9000` — see `.env.development.example`. Useful commands:

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

### 6. (Optional) Run the mobile app

`apps/mobile` (Expo) deliberately does **not** join `pnpm dev` above —
Expo's CLI is its own interactive terminal (QR code, keyboard shortcuts)
that doesn't multiplex well alongside `next dev`/`nest start --watch`'s
log output in one Turborepo pane. It has its own env file too, since Metro
reads `EXPO_PUBLIC_*` vars natively from an `.env` at the app's own root
rather than the `dotenv-cli` pattern `apps/web`/`apps/api` use:

```bash
cp apps/mobile/.env.development.example apps/mobile/.env
```

The default (`http://localhost:4000`) works as-is for the **iOS
Simulator** only, since it shares the Mac's own network stack. A physical
device or the **Android emulator** can't reach `localhost` (on-device,
that means the device itself) — see the comments in
`apps/mobile/.env.development.example` for the LAN-IP / `10.0.2.2`
alternatives. Then, with `apps/api` already running (step 5 above):

```bash
pnpm dev:mobile    # Expo Dev Tools — scan the QR code with Expo Go
pnpm dev:ios       # boots the iOS Simulator directly (needs Xcode)
pnpm dev:android   # boots an Android emulator directly (needs Android Studio)
```

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
pnpm --filter @spine/api test:integration  # requires dev infra running — see below on which DB this hits
```

Schema lives in `apps/api/src/db/schema/`; after changing it, run
`db:generate` to produce a migration file in `apps/api/drizzle/`, review the
generated SQL, then `db:migrate` to apply it.

**`test:integration` runs against a separate `spine_test` database, not your
dev DB** — some integration tests (e.g. the ledger-integrity suite) `TRUNCATE`
real tables including `organization ... CASCADE` as part of their own
cleanup, which would otherwise delete every org/user/session in whatever
database is pointed at. `.env.test` (repo root, checked into git — no
secrets in it, just a DB name) overrides `DATABASE_URL` to
`spine_test` for this one script only; `apps/api/package.json`'s
`test:integration` script loads it. One-time setup, after your `db`
container is up:

```bash
docker exec spine-dev-db-1 psql -U spine -d spine -c "CREATE DATABASE spine_test;"
pnpm --filter @spine/api exec dotenv -e ../../.env.test -e ../../.env -- drizzle-kit migrate
```

Re-run the second command after any schema change to keep `spine_test`'s
schema in sync with `spine`'s.

The files run in parallel (D-239): before a run, each worker gets its own
copy of `spine_test` (`spine_test_w1` … `spine_test_w4`, made with
`CREATE DATABASE … TEMPLATE` and dropped afterwards), so no file sees
another's rows. `SPINE_TEST_WORKERS` sets how many workers (4 locally, 1 in
CI, whose two-core runner was slower with two); `SPINE_TEST_WORKERS=1` runs
one file at a time.

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
(`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`) — see `docs/prd/01-tech-stack.md`.
Attachments work out of the box: the API stores them on the `spine_files`
volume (`STORAGE_DRIVER=local`). `docker compose down -v` deletes that
volume along with the database, so don't use `-v` unless you mean it. To
keep files in S3, R2 or B2 instead, set `STORAGE_DRIVER=s3` and the `S3_*`
values; add `--profile rustfs` to run a self-hosted S3 store. Use the
`full` profile instead of `minimal` to add the Cloudflare Tunnel sidecar.

### Updating

When a new version is out, Owners see "Spine <version> is available" at the
top of every page (the server checks GitHub Releases once a day and sends
nothing about your install; set `UPDATE_CHECK=off` in `.env` to turn that
off). To update, from the folder with your `.env`:

```bash
./upgrade.sh                    # to the latest release
./upgrade.sh --version 1.0.1    # to a given version
```

(In a clone of this repo it's `./scripts/upgrade.sh`, after checking out the
version's tag.)

It backs up first, pulls the new version's images and restarts. The API
takes a database snapshot, then applies the new version's migrations before
it serves anyone; if a migration fails it stops and names the snapshot to
restore. Your `.env` is kept, apart from `SPINE_VERSION`. On Coolify, see
[the Coolify guide](docs/self-hosting-coolify.md#upgrading-to-a-new-beta).
Settings › About Spine shows the version you're on.

### Upgrading an install that used MinIO

Spine now stores files on the API's own volume (`STORAGE_DRIVER=local`,
the default) instead of MinIO, and `docker-compose.yml` no longer starts
MinIO. You can either:

- **Move your files to local storage (recommended).** Keep MinIO running
  and your `S3_*` settings in `.env`, start the new version, then run
  `docker compose exec api pnpm --filter @spine/api files:migrate --from s3 --to local`.
  It copies every file into the `spine_files` volume, checks each copy
  against its checksum, and prints copied, skipped and failed counts.
  Nothing in the bucket is changed or deleted. If anything fails, it lists
  those files and exits with an error; fix the cause and run it again, and
  files already moved are skipped. When it reports no failures, set
  `STORAGE_DRIVER=local` (or remove it) and restart. You can stop MinIO
  once you've checked your attachments.
- **Keep MinIO.** Set `STORAGE_DRIVER=s3`, keep your `S3_*` settings, and
  run MinIO yourself, for example from your old compose file or as its own
  service. Spine works unchanged.

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

### Artwork

The people on the signed-out pages are [Open Peeps](https://www.openpeeps.com/) by Pablo Stanley, released under CC0.
