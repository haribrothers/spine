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
8. **The docs site** publishes itself from `main` (US-SITE-14); a new minor version archives the previous minor's docs (US-SITE-13).

## If a release goes wrong

- A check failed: fix it on a branch, merge, and tag the next patch (`v1.0.1`). Never move or reuse a tag.
- A published release is broken: mark the GitHub release as a pre-release (so `latest` and the update banner stop offering it), publish a fixed patch, and say so in its notes.
