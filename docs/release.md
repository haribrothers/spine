# Releasing Spine

How a version of Spine is numbered, written up and published. The decisions behind it are [D-260](prd/12-decisions.md) (E2E before a release), [D-262](prd/12-decisions.md) (distribution) and [D-264](prd/12-decisions.md) (migrations and upgrades). The field app's store release is [15-mobile-release.md](prd/15-mobile-release.md).

## Versioning

- Semantic versioning, `MAJOR.MINOR.PATCH`. A patch fixes things, a minor adds things, and a major can break an install (its release notes say exactly what to do).
- Pre-releases carry a suffix: `1.0.0-beta.3`, `1.1.0-rc.1`. They are GitHub pre-releases, never `latest`, and the update banner ignores them (US-OPS-06).
- The version lives in one place, the root `package.json`. The tag must be `v` plus that version, or the release stops at its first step (`scripts/release/version.mjs`).
- The default image tag in `docker-compose.yml`, `docker/coolify/docker-compose.yml` and `docker/panels/docker-compose.yml` (`${SPINE_VERSION:-<version>}`) is the same version; `scripts/us-ops-52.test.mjs` and `us-ops-53.test.mjs` check the Coolify and panels ones.
- Migrations only go forward. An upgrade takes a database snapshot first, and Spine never goes back a version: to return to an older one, restore a backup made on it.

## Changelog and release notes

- `CHANGELOG.md` gets an entry with every change, under its date, as the work lands (CLAUDE.md).
- For a release, write `docs/releases/v<version>.md`: what's new for the people using Spine, what the person who runs the server must do (new `.env` values, anything breaking), and the stories it includes. The release workflow publishes it as the GitHub release's notes; without it, GitHub's notes from the merged pull requests are used.
- A breaking change is listed first, under "Before you upgrade".

## Steps

1. **Finish the phase.** Every story is ticked in `docs/progress.md`, its pull request is merged into `main`, and `pnpm verify` passed on the merged commit.
2. **Set the version.** On a branch: bump `version` in the root `package.json`, the `SPINE_VERSION` defaults above and the tag in the download command (`v=v<version>`, in `README.md`, `apps/docs/src/content/docs/self-hosting/install.md`, `get-started/install.md` and the home page's `apps/site/src/locales/en/home.ts`), and write `docs/releases/v<version>.md`. Run `pnpm test` (the scripts' tests check the versions agree). Merge it.
3. **Tag `main`.** `git tag v<version> && git push origin v<version>`. Tags are made by the Owner.
4. **CI runs everything.** On a `v*` tag, CI runs lint, typecheck, unit, integration, the E2E suite, the self-hosting check (install, back up, restore) and the upgrade check from the previous release (`upgrade-verify`, `install.sh --non-interactive` then `upgrade.sh`). Nothing is published unless all of them pass.
5. **The release workflow publishes** (`.github/workflows/release.yml`):
   - `ghcr.io/haribrothers/spine-api`, `spine-web` and `spine-proxy` (Caddy with Spine's routing built in, [D-280](prd/12-decisions.md)), tagged `<version>`, and `latest` too unless it's a pre-release. Images are amd64 and arm64 (betas before `1.0.0-beta.3` were amd64 only, while the repo was private, [D-278](prd/12-decisions.md)).
   - A GitHub release named "Spine <version>" (a pre-release for a suffixed tag) with `install.sh`, `backup.sh`, `restore.sh`, `upgrade.sh`, the `docker-compose.yml` that pulls those images, the `Caddyfile` (the routing `spine-proxy` carries, to start your own from; `upgrade.sh` from before D-280 downloads it), `env.example`, the Coolify Compose file, `docker-compose.panels.yml` for Docker panels (D-281) and `SHA256SUMS`. `upgrade.sh` checks the files against `SHA256SUMS`.
6. **Check it.** On a test server, `./upgrade.sh --version <version>` from the previous release keeps the data; Settings › About Spine shows the new version; the update banner appears on an install of the previous version once its daily check has run.
7. **The Runtipi store** ([D-282](prd/12-decisions.md)): in [haribrothers/spine-runtipi](https://github.com/haribrothers/spine-runtipi), set `version` in `apps/spine/config.json` and the three image tags in `apps/spine/docker-compose.yml` to the new version, add one to `tipi_version` (Runtipi offers the update when it goes up) and set `updated_at` to now (milliseconds), then push to its `main`. Runtipi installs pick it up with **Settings › Update App Stores**.
8. **The field app**, when it changed: build and submit it as [15-mobile-release.md](prd/15-mobile-release.md) describes (for a beta, `scripts/mobile/build-beta.sh`, [docs/beta.md](beta.md)).
9. **The website and docs** publish themselves from `main` (US-SITE-14, below). For a new **minor** version (1.1, 1.2 …), first add the previous minor to `apps/docs/src/versions.json` (`{ "archived": [{ "slug": "1.0" }] }`, newest first) and build once: `starlight-versions` copies the current docs into `src/content/docs/1.0/`. Commit that copy with the version bump, then update the docs for the new version. The version menu appears from the first archived version (US-SITE-13).

## The website and docs (US-SITE-14, D-273, D-274)

The site is one Cloudflare **Worker with static assets** (`spine-site`), built by Workers Builds, Cloudflare's Git integration: no GitHub workflow and no Actions minutes. `pnpm site:build` puts the home page (`apps/site`) at the root and the docs (`apps/docs`) under `/docs/`, in `apps/site/dist`. `wrangler.jsonc` at the repo root tells Wrangler to serve that folder, to answer a missing page with the nearest `404.html`, to allow branch previews (`wrangler preview` needs its `previews` block, even empty), and to send no telemetry, so Cloudflare's default deploy and preview commands work unchanged. It's public even while the repo is private.

Cloudflare's dashboard combines Workers and Pages, and **Create** makes a Worker. That's what this setup expects, so there's no Pages option to look for.

### 1. Create the Worker from the repo
1. In the Cloudflare dashboard, open **Workers & Pages** (under Compute in the sidebar) › **Create application**.
2. Choose **Continue with GitHub** (or **Import a repository**), authorise the Cloudflare app for `haribrothers/spine`, and select the repo.
3. Fill in the form as the table in step 2 shows, then **Create and deploy**.

### 2. Build settings
For an existing Worker: **Workers & Pages** › select `spine-site` › **Settings** › **Build**. Each part has its own edit (pencil) button. Changes apply to the next build.

| Where in Settings › Build | Field | Value |
|---|---|---|
| Git repository | Repository | `haribrothers/spine` |
| Build configuration | Build command | `pnpm install --frozen-lockfile --filter @spine/site... --filter @spine/docs... && pnpm site:build` |
| Build configuration | Deploy command | `npx wrangler deploy` (the default) |
| Build configuration | Preview command (non-production branches) | the default, `npx wrangler preview` (older screens: `npx wrangler versions upload`) |
| Build configuration | Root directory | `/` (leave empty) |
| Build variables and secrets | Variables | `NODE_VERSION` = `22`, `PNPM_VERSION` = `9.15.9` |
| Branch control | Production branch | `main` |
| Branch control | Enable Preview Builds | On |
| Build watch paths | Include paths | `apps/site/*`, `apps/docs/*`, `packages/shared/src/public-site.ts`, `docs/design/tokens.json`, `scripts/site/*`, `package.json`, `pnpm-lock.yaml`, `wrangler.jsonc` |
| Build watch paths | Exclude paths | none |

Build variables apply only to the build; nothing goes under **Settings › Variables and secrets** (runtime), since the site has no code. There's no output-directory field: `wrangler.jsonc` names the folder.

These settings live only in the dashboard. `wrangler.jsonc` can't hold them: Workers Builds ignores Wrangler's `build` block, and its `watch_dir` only controls what `wrangler dev` reloads.

#### Build watch paths
A new Worker builds on a change to any file (Include paths `*`). Until the paths are set, a pull request that changes only the API, the web app or the spec in `docs/` still gets a site build.
1. **Workers & Pages** › `spine-site` › **Settings** › **Build** › **Build watch paths** › edit (pencil).
2. **Include paths:** replace `*` with the paths in the table above, one per field: `apps/site/*`, `apps/docs/*`, `packages/shared/src/public-site.ts`, `docs/design/tokens.json`, `scripts/site/*`, `package.json`, `pnpm-lock.yaml`, `wrangler.jsonc`. A trailing `*` matches everything under that folder, subfolders included.
3. **Exclude paths:** leave empty. **Save**. It applies from the next push.
   The **Production** and **Previews Base** tabs at the top of Builds each have their own settings, so set and save the paths on both. Production covers `main`; Previews Base covers every other branch.
4. Check it: push a commit to a branch that changes only a file in `docs/`. The commit gets no new "Workers Builds: spine-site" check, and **Deployments** shows no new build.

The two paths outside the site folders are the files the builds read from elsewhere in the repo: the domain (`public-site.ts`) and the design tokens. If either site starts reading another file outside `apps/site`, `apps/docs` or `scripts/site`, add it here, or a change to it won't publish. `package.json` and `pnpm-lock.yaml` also start a build when an unrelated dependency changes; that's the safe side, since the lockfile decides what the site builds with.

Cloudflare builds regardless of the paths when a push has no file changes, or 3,000 or more files, or 20 or more commits. A skipped build doesn't block a merge: "Workers Builds: spine-site" isn't a required check, and CI's Sites job builds both sites on any pull request that changes them.

### 3. Domain and previews
**Settings** › **Domains & Routes**:
- **Custom domain:** **Add** › **Custom domain** › `spine.h4loom.com` › **Add Custom Domain**. The domain has to be a zone on this Cloudflare account. Cloudflare creates the DNS record and the certificate. It refuses a hostname that already has a CNAME record, so delete any existing `spine` CNAME first.
- **workers.dev** and **Preview URLs:** on (`wrangler.jsonc` sets both). The `spine-site.<subdomain>.workers.dev` address is where the first build lands, before the domain is added.
- Leave **Observability** (Workers Logs) off. Cloudflare's Web Analytics isn't added to a Worker, so there's nothing to turn off.

**HTTPS:** the custom domain gets a certificate, but `http://` is still answered as plain HTTP until the zone redirects it. In the `h4loom.com` zone (**Domains** › `h4loom.com`) › **SSL/TLS** › **Edge Certificates**:
- **Always Use HTTPS:** on. It redirects every `http://` request in the zone with a 301, keeping the path and query string. It takes effect within seconds, with no Save button.
- **Minimum TLS Version:** TLS 1.2. **Automatic HTTPS Rewrites:** on.
- **HTTP Strict Transport Security (HSTS):** leave it off until every hostname in the zone serves HTTPS. Browsers remember it for months, so it's hard to undo.
- Leave the encryption mode (**SSL/TLS** › **Overview**) as it is: a Worker custom domain has no origin server behind it.

Always Use HTTPS applies to every hostname in the zone. To redirect only the site, leave it off and add a redirect rule instead (**Rules** › **Overview** › **Create rule** › **Redirect Rule**): custom filter expression **SSL/HTTPS** equals **Off** and **Hostname** equals `spine.h4loom.com`; then **Dynamic**, expression `concat("https://", http.host, http.request.uri)`, status **301**, **Preserve query string** ticked; **Deploy**.

### 4. Check it
Retry the latest build (**Deployments**, or push a commit). The build log ends "Built the home page and the docs into apps/site/dist" and then Wrangler's upload. Open the workers.dev address, then `https://spine.h4loom.com/`: the home page at `/`, the docs at `/docs/`, and a made-up address under `/docs/` shows the docs' 404 page. `curl -sI http://spine.h4loom.com/docs/` answers `301` with `location: https://spine.h4loom.com/docs/`.

A branch's preview (`<branch>-spine-site.<subdomain>.workers.dev`) serves the same pages, but a made-up address there gets Cloudflare's plain "Not found" instead of the site's 404 page: Worker Previews don't apply `not_found_handling` (seen with Wrangler 4.158; Cloudflare's docs don't cover it). Check the 404 pages on production.

If a branch build fails with "Your Wrangler configuration is missing a `previews` block", the commit predates that block in `wrangler.jsonc`; rebase it on `main`.

If the deploy step fails with "The Cloudflare application detection logic has been run in the root of a workspace", Wrangler didn't find `wrangler.jsonc`: check that **Root directory** is `/` and that the commit being built has the file.

### Afterwards
- **The domain** is set once, in `packages/shared/src/public-site.ts` (D-273). To change it, edit that file, then run `pnpm test:scripts`: it names the files that spell the addresses out (the README, `.github/ISSUE_TEMPLATE/config.yml`). Then change the Worker's custom domain to match.
- **The bare domain** (`h4loom.com`) isn't part of the site. To send it to the home page, add a Cloudflare redirect rule from `h4loom.com/*` to `https://spine.h4loom.com/${1}` (in the `h4loom.com` zone, **Rules** › **Redirect Rules**). The bare domain needs a proxied DNS record for the rule to run.
- A push to any other branch gets a preview address (Preview Builds), to check before merging. It's listed on the build in **Deployments** and on the commit in GitHub.
- A merge or branch push that doesn't touch the watch paths doesn't build it (step 2 › Build watch paths).
- A failed build — a broken internal link fails it (`starlight-links-validator`, and the check of the home page's links into `/docs/`) — leaves the live site as it was.
- CI and `pnpm verify` run the same `pnpm site:build` on every change to either site, so a pull request shows a broken link before it reaches `main`.

## If a release goes wrong

- A check failed before anything was published (no GitHub release, no images on GHCR): fix it on a branch and merge, then delete the tag (`git push origin :refs/tags/v<version>` and `git tag -d v<version>`) and tag the fixed commit with the same version. Nobody can have that version, so it still names one build.
- A check failed after something was published: fix it on a branch, merge, and tag the next patch (`v1.0.1`). Never move or reuse a tag once anything is published under it.
- A published release is broken: mark the GitHub release as a pre-release (so `latest` and the update banner stop offering it), publish a fixed patch, and say so in its notes.
