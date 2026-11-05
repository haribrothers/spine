# Releasing Spine

How a version of Spine is numbered, written up and published. The decisions behind it are [D-260](prd/12-decisions.md) (E2E before a release), [D-262](prd/12-decisions.md) (distribution) and [D-264](prd/12-decisions.md) (migrations and upgrades). The field app's store release is [15-mobile-release.md](prd/15-mobile-release.md).

## Versioning

- Semantic versioning, `MAJOR.MINOR.PATCH`. A patch fixes things, a minor adds things, and a major can break an install (its release notes say exactly what to do).
- Pre-releases carry a suffix: `1.0.0-beta.3`, `1.1.0-rc.1`. They are GitHub pre-releases, never `latest`, and the update banner ignores them (US-OPS-06).
- The version lives in one place, the root `package.json`. The tag must be `v` plus that version, or the release stops at its first step (`scripts/release/version.mjs`).
- The default image tag in `docker-compose.yml` and `docker/coolify/docker-compose.yml` (`${SPINE_VERSION:-<version>}`) is the same version; `scripts/us-ops-52.test.mjs` checks the Coolify one.
- Migrations only go forward. An upgrade takes a database snapshot first, and Spine never goes back a version: to return to an older one, restore a backup made on it.

## Changelog and release notes

- `CHANGELOG.md` gets an entry with every change, under its date, as the work lands (CLAUDE.md).
- For a release, write `docs/releases/v<version>.md`: what's new for the people using Spine, what the person who runs the server must do (new `.env` values, anything breaking), and the stories it includes. The release workflow publishes it as the GitHub release's notes; without it, GitHub's notes from the merged pull requests are used.
- A breaking change is listed first, under "Before you upgrade".

## Steps

1. **Finish the phase.** Every story is ticked in `docs/progress.md`, its pull request is merged into `main`, and `pnpm verify` passed on the merged commit.
2. **Set the version.** On a branch: bump `version` in the root `package.json`, the two `SPINE_VERSION` defaults above, and write `docs/releases/v<version>.md`. Run `pnpm test` (the scripts' tests check the versions agree). Merge it.
3. **Tag `main`.** `git tag v<version> && git push origin v<version>`. Tags are made by the Owner.
4. **CI runs everything.** On a `v*` tag, CI runs lint, typecheck, unit, integration, the E2E suite, the self-hosting check (install, back up, restore) and the upgrade check from the previous release (`upgrade-verify`, `install.sh --non-interactive` then `upgrade.sh`). Nothing is published unless all of them pass.
5. **The release workflow publishes** (`.github/workflows/release.yml`):
   - `ghcr.io/haribrothers/spine-api` and `ghcr.io/haribrothers/spine-web`, tagged `<version>`, and `latest` too unless it's a pre-release. Images are amd64 and arm64 (amd64 only while the repo is private).
   - A GitHub release named "Spine <version>" (a pre-release for a suffixed tag) with `install.sh`, `backup.sh`, `restore.sh`, `upgrade.sh`, the `docker-compose.yml` that pulls those images, the `Caddyfile`, `env.example`, the Coolify Compose file and `SHA256SUMS`. `upgrade.sh` checks the files against `SHA256SUMS`.
6. **Check it.** On a test server, `./upgrade.sh --version <version>` from the previous release keeps the data; Settings › About Spine shows the new version; the update banner appears on an install of the previous version once its daily check has run.
7. **The field app**, when it changed: build and submit it as [15-mobile-release.md](prd/15-mobile-release.md) describes (for a beta, `scripts/mobile/build-beta.sh`, [docs/beta.md](beta.md)).
8. **The website and docs** publish themselves from `main` (US-SITE-14, below). For a new **minor** version (1.1, 1.2 …), first add the previous minor to `apps/docs/src/versions.json` (`{ "archived": [{ "slug": "1.0" }] }`, newest first) and build once: `starlight-versions` copies the current docs into `src/content/docs/1.0/`. Commit that copy with the version bump, then update the docs for the new version. The version menu appears from the first archived version (US-SITE-13).

## The website and docs (US-SITE-14, D-273)

One Cloudflare Pages project builds from this repo with Cloudflare's Git integration: no GitHub workflow and no Actions minutes. `pnpm site:build` puts the home page (`apps/site`) at the root and the docs (`apps/docs`) under `/docs/`. It's public even while the repo is private. Set it up once in the Cloudflare dashboard (Workers & Pages › Create › Pages › Connect to Git, choosing `haribrothers/spine`):

| Setting | Value |
|---|---|
| Project name | `spine-site` |
| Production branch | `main` |
| Framework preset | None |
| Root directory | `/` |
| Build command | `pnpm install --frozen-lockfile --filter @spine/site... --filter @spine/docs... && pnpm site:build` |
| Build output directory | `apps/site/dist` |
| Environment variables | `NODE_VERSION=22`, `PNPM_VERSION=9.15.9` |
| Build watch paths (include) | `apps/site/*`, `apps/docs/*`, `packages/shared/src/public-site.ts`, `docs/design/tokens.json`, `scripts/site/*`, `package.json`, `pnpm-lock.yaml` |
| Custom domain | `spine.h4loom.com` |
| Web Analytics | Off |

- **The domain** is set once, in `packages/shared/src/public-site.ts` (D-273). To change it, edit that file, then run `pnpm test:scripts`: it names the files that spell the addresses out (the README, `.github/ISSUE_TEMPLATE/config.yml`). Then change the project's custom domain to match.
- **The bare domain** (`h4loom.com`) isn't part of the site. To send it to the home page, add a Cloudflare redirect rule from `h4loom.com/*` to `https://spine.h4loom.com/${1}`.
- A push to any other branch gets a preview address (Pages' preview deployments), to check before merging.
- A merge that doesn't touch the watch paths doesn't build it.
- A failed build — a broken internal link fails it (`starlight-links-validator`, and the check of the home page's links into `/docs/`) — leaves the live site as it was.
- CI and `pnpm verify` run the same `pnpm site:build` on every change to either site, so a pull request shows a broken link before it reaches `main`.

## If a release goes wrong

- A check failed: fix it on a branch, merge, and tag the next patch (`v1.0.1`). Never move or reuse a tag.
- A published release is broken: mark the GitHub release as a pre-release (so `latest` and the update banner stop offering it), publish a fixed patch, and say so in its notes.
