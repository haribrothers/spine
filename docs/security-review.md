# Security review before 1.0

US-OPS-18 · [D-267](prd/12-decisions.md): in-house, against the OWASP Top 10 (2021) and OWASP ASVS, signed off by the Owner. The rules this checks against are in [07-security.md](prd/07-security.md).

| | |
|---|---|
| Reviewed | 2026-11-04, branch `phase-12-packaging` |
| Scope | `apps/api`, `apps/web`, `apps/mobile`, the Docker/Caddy install, `scripts/` (install, backup, restore, upgrade) |
| Method | Code review by area, `pnpm audit --prod`, gitleaks over the whole history, a ZAP baseline scan of a running install, and automated tests for the public routes |
| Result | Every finding below is fixed or accepted. Nothing high-severity is open. |

## OWASP Top 10

| # | Area | What was checked | Finding | Outcome |
|---|---|---|---|---|
| A01 | Broken access control | Every controller's guards (`@OrgRoles`, `@RequireCapability`), ownership checks in services before status checks, the shared capability list (`packages/shared/src/schemas/permissions.ts`), Field filtering of money fields, files served only through authorised routes or signed links, the web app's page access | Nothing new. Covered by the `*-ownership` integration tests, US-OPS-12/US-OPS-20, and the Field reach tests | Accepted (no change) |
| A02 | Cryptographic failures | Argon2id passwords, HTTP-only session cookies (`Secure` over HTTPS), signed quote-link JWTs with a random nonce, `secret-box.ts` for stored secrets (AI keys, D-094), AES-GCM backup archives, TLS from Caddy | No HSTS header was sent | **Fixed:** `Strict-Transport-Security` on every page when `APP_URL` is https (`apps/web/next.config.ts`) |
| A03 | Injection | Every query goes through Drizzle (parameterised); `sql.raw` appears only in the dev reset script and restore, with fixed names. Request bodies are validated with zod. React escapes output; the one inline script (`org-theme-preset.tsx`) takes a value from a fixed list. PDF and email templates only fill known placeholders | None | Accepted (no change) |
| A04 | Insecure design | Idempotency keys on every write, gapless numbering under row locks, immutable journal entries, the demo-claim row lock (US-OPS-02), confirmation before major actions | None | Accepted (no change) |
| A05 | Security misconfiguration | Response headers, CORS, proxy trust, defaults, telemetry, the OpenAPI page | (1) No `X-Frame-Options`, `X-Content-Type-Options` or `Referrer-Policy`, and `X-Powered-By` was sent. (2) The API didn't trust the reverse proxy, so every visitor shared one rate-limit bucket: anyone could use up the 20-a-minute public limit for every customer. (3) `/api/docs` (OpenAPI) is public | **Fixed (1):** the web app sends `X-Frame-Options: DENY`, `nosniff`, `strict-origin-when-cross-origin` and a `Permissions-Policy`; the API sends `DENY`, `nosniff`, `no-referrer` and drops `X-Powered-By`. **Fixed (2):** the API trusts loopback and private-network proxies (`TRUST_PROXY` overrides), so limits are per visitor. **Accepted (3):** the API is open source; the page shows routes, not data, and every route still needs its session |
| A06 | Vulnerable and outdated components | `pnpm audit --prod` | 9 critical and 49 high advisories, among them Next.js remote code execution in image optimisation, multer, body-parser, proxy-addr, undici, nodemailer, DOMPurify and ProseMirror | **Fixed**, with reviewed exceptions in build tooling: see [Dependencies](#dependencies). CI fails on any new high or critical advisory (`pnpm audit --prod --audit-level high`) |
| A07 | Identification and authentication failures | Sign-up closed after the first user (US-AUTH-08), single-use 1-hour password reset that never reveals whether an account exists (US-AUTH-09), Better Auth's sign-in limit (3 per 10 s per address), session revocation on deactivation, explicit session lifetime | No second factor | **Accepted for 1.0:** passwords are Argon2id with a strength check and limited attempts; two-factor sign-in is on the roadmap |
| A08 | Software and data integrity failures | Release images built by CI from tags, `upgrade.sh` checking the release files against `SHA256SUMS`, frozen lockfile installs, the update check reading only GitHub Releases (US-OPS-06), migrations after a snapshot | None | Accepted (no change) |
| A09 | Logging and monitoring failures | Request logs with ids and redaction (US-OPS-07), the business audit log, failed-email and backup-age banners | None | Accepted (no change) |
| A10 | Server-side request forgery | Outbound requests: the AI provider (Owner-set base URL), a connecting agent's client metadata (D-257), S3 storage (`S3_ENDPOINT` from `.env`), the update check (fixed URL) | Agent metadata is the only URL an outsider can choose: Better Auth's CIMD transport accepts only public https addresses, pins the resolved address and never follows redirects. The AI base URL can point inside the network, but only an Owner can set it | Accepted (no change) |

## Public routes

`apps/api/src/common/us-ops-18.http.integration.test.ts`:

- A guessed, malformed or tampered quote token gets the same 404 as any other wrong token, and a real one still works. Tokens are signed and carry a 24-byte random nonce.
- A guessed invitation id gets the same 404. Ids are 32 random characters (about 190 bits).
- Quote and invitation lookups stop at 20 a minute per visitor (429), and another visitor isn't affected.
- Every API response carries the headers above.

## Dependencies

`pnpm audit --prod` first found 9 critical and 49 high advisories. After the fixes it reports none that aren't reviewed below, and CI fails on any new high or critical one (`pnpm audit --prod --audit-level high`, also a `pnpm verify` step).

**Upgraded:** Next.js 15.5.22 → 15.5.28 (remote code execution in image optimisation, a Server Actions DoS), nodemailer 9 → 10.0.6 (address-parser DoS), Tiptap 3.29 → 3.30.5 and ProseMirror view 1.42.3 (paste XSS, Markdown ReDoS), DOMPurify 3.4.17, Vitest 2 → 3.2.7 with Vite 6.4. **Pinned with `pnpm.overrides`** to fixed versions in the same major line: body-parser, brace-expansion, compression, fast-uri, form-data (from the docs site's API reference), js-yaml, multer, nanoid, postcss, proxy-addr, shell-quote, source-map-js and undici. The full API integration suite (1,348 tests), every unit suite and the E2E suite pass on the upgraded set.

**Accepted** (listed by id in `package.json` › `pnpm.auditConfig.ignoreGhsas`):

| Advisories | Package | Why it's accepted |
|---|---|---|
| GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr | tinypool 1.1 (Vitest's worker pool) | Test tooling. Vitest 3 still pins tinypool 1.x. It reaches the API image only because pnpm links better-auth's optional `vitest` peer; the API never imports it, and both need attacker-controlled worker options |
| GHSA-86w9-cpqp-85rv, GHSA-7wch-p9px-956x, GHSA-jc66-7q78-782g, GHSA-8hrf-8g6f-7xwp, GHSA-hqq3-7jhf-c5jx, GHSA-5x38-2vff-x55p | node-forge 1.4.0 | The Expo CLI's code-signing helper, reached through drizzle-orm's optional `expo-sqlite` peer. Never loaded by the API; one advisory has no fixed version yet |
| GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr | image-size 1.2 | Expo/React Native build tooling (same optional peer); the fix is a major version those tools don't support yet |
| GHSA-mrhx-c7xc-m3w5 | zod 3.25 | Used by the Expo CLI only; Spine's own code uses zod 4.6 |
| GHSA-qr28-fpjm-wq7f | decode-uri-component 0.2 | expo-router's query parsing at build time; not in the API's runtime |

A follow-up keeps these out of the API image altogether (they're linked as optional peers of better-auth and drizzle-orm): [R-30](prd/13-risks-open-questions.md).

## Secret scan

gitleaks v8.24.3 over the whole history (645 commits): 10 findings, all reviewed and accepted as not secrets. They are test passwords and session cookies in integration tests, a test push-subscription key, and the S3 driver reading its key from the environment. `.gitleaksignore` lists their fingerprints, so a rerun reports "no leaks found".

## ZAP baseline

ZAP 2.x baseline (`zap-baseline.py`, passive, ghcr.io/zaproxy/zaproxy:stable) against a running install, 2026-11-05: the web app (`/login`) and the API (`/health`).

| Target | Fail | Warn | Pass |
|---|---|---|---|
| Web app | 0 | 5 | 63 |
| API | 0 | 1 | 67 |

Nothing high-severity. The warnings:

| Warning | Risk | Outcome |
|---|---|---|
| Content Security Policy header not set | Medium | **Accepted for 1.0.** Next.js inline scripts need per-request nonces, so a strict CSP is a change of its own. Framing is already refused (`X-Frame-Options: DENY`), React escapes all output, the one inline script takes a value from a fixed list, and user HTML (rich text) is sanitised with DOMPurify. A CSP is tracked as [R-31](prd/13-risks-open-questions.md) |
| Cross-Origin-Embedder-Policy missing | Low | Accepted: Spine uses no cross-origin isolated features (SharedArrayBuffer) |
| Big redirect detected | Informational | Accepted: the signed-out redirect to `/login` carries Next.js's standard body, with no data |
| Non-storable / storable content | Informational | Accepted: pages are dynamic and per-session; the API's health answer may be cached |
| Modern web application | Informational | Not a finding |

## Sign-off

| | |
|---|---|
| Reviewed by | Claude Code, for the Owner |
| Signed off by the Owner | _pending — Hari Prasad_ |
| Date | |
