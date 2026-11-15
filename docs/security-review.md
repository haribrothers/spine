# Security review before 1.0

US-OPS-18 · [D-267](prd/12-decisions.md): in-house, against the OWASP Top 10 (2021) and OWASP ASVS, signed off by the Owner. The rules this checks against are in [07-security.md](prd/07-security.md).

| | |
|---|---|
| Reviewed | 2026-11-04, branch `phase-12-packaging`. Refreshed 2026-11-15 against `main` at `28029273` (branch `phase-12-security-signoff`) |
| Scope | `apps/api` (including the MCP endpoint and OAuth for connected agents), `apps/web`, `apps/mobile`, the Docker/Caddy install, `scripts/` (install, backup, restore, upgrade) |
| Method | Code review by area, `pnpm audit --prod`, gitleaks over the whole history, a ZAP baseline scan of a running install, and automated tests for the public routes and CSV exports |
| Result | Every finding below is fixed or accepted. Nothing high-severity is open. Signed off by the Owner on 2026-11-15 |

## OWASP Top 10

| # | Area | What was checked | Finding | Outcome |
|---|---|---|---|---|
| A01 | Broken access control | Every controller's guards (`@OrgRoles`, `@RequireCapability`), ownership checks in services before status checks, the shared capability list (`packages/shared/src/schemas/permissions.ts`), Field filtering of money fields, files served only through authorised routes or signed links, the web app's page access. **Connected agents (D-259):** MCP tools call Spine's own REST routes on loopback as the person who connected the agent, in a session of their own, so every guard runs as for that person's web requests. Agents can only read and create (no PUT, PATCH or DELETE). The `spine:draft` scope is the intersection of what the token carries and what the person ticked on the consent page. Re-checked on 2026-11-15: the new job-photo delete (US-JOB-39) checks the job first, then ownership with `requireOwnershipCapability`, then the lock | Nothing new. Covered by the `*-ownership` integration tests, US-OPS-12/US-OPS-20, the Field reach tests and `us-mcp-05`/`us-mcp-06` (a Staff member without invoices can't read one through an agent; Field gets only their assigned jobs, without money) | Accepted (no change) |
| A02 | Cryptographic failures | Argon2id passwords, HTTP-only session cookies (`Secure` over HTTPS), signed quote-link JWTs with a random nonce, HMAC-signed 5-minute file links compared in constant time (each signature prefixed with its purpose, e.g. `file:`), `secret-box.ts` for stored secrets (AI keys, D-094), AES-GCM backup archives, TLS from Caddy | No HSTS header was sent | **Fixed:** `Strict-Transport-Security` on every page when `APP_URL` is https (`apps/web/next.config.ts`) |
| A03 | Injection | Every query goes through Drizzle (parameterised); `sql.raw`/`unsafe` appear only in the dev reset script, restore and the integration-test setup, with fixed names. Request bodies are validated with zod. React escapes output; the one inline script (`org-theme-preset.tsx`) takes a value from a fixed list. PDF and email templates only fill known placeholders. Uploads are typed from their bytes, not the name or the client's type; only image and PDF types are served inline, with `nosniff`. **CSV exports** (refresh, 2026-11-15) | **CSV (formula) injection:** `toCsv` escaped quotes but wrote a cell starting with `=`, `+`, `-` or `@` unchanged, so Excel or Sheets ran it as a formula. Outsiders can put text in exports: a customer types the signer name on the public quote link (any text, up to 200 characters) and a payer writes a bank statement's description. The data export, the audit log, the tax summary and every report CSV went through it, and so did the web app's catalogue export | **Fixed:** one rule, `CSV_FORMULA_CELL` in `packages/shared/src/csv.ts`, puts a `'` in front of such a cell unless it's a plain number. Used by the API's `toCsv` and by the web app's `Papa.unparse` (`escapeFormulae`); Spine's own CSV imports take the `'` off again, so an export imports back unchanged. The XLSX export writes text as text (ExcelJS) and needed no change. Tests: `us-ops-18` in `packages/shared`, `apps/api/src/common/us-ops-18-csv.test.ts`, `apps/web/src/__tests__/us-ops-18.test.ts` |
| A04 | Insecure design | Idempotency keys on every write, scoped to organisation, user and endpoint (one person can never replay another's response), gapless numbering under row locks, immutable journal entries, the demo-claim row lock (US-OPS-02), confirmation before major actions | None | Accepted (no change) |
| A05 | Security misconfiguration | Response headers, CORS (`APP_URL` only, with credentials), proxy trust, defaults, telemetry, the OpenAPI page | (1) No `X-Frame-Options`, `X-Content-Type-Options` or `Referrer-Policy`, and `X-Powered-By` was sent. (2) The API didn't trust the reverse proxy, so every visitor shared one rate-limit bucket: anyone could use up the 20-a-minute public limit for every customer. (3) `/api/docs` (OpenAPI) is public | **Fixed (1):** the web app sends `X-Frame-Options: DENY`, `nosniff`, `strict-origin-when-cross-origin` and a `Permissions-Policy`; the API sends `DENY`, `nosniff`, `no-referrer` and drops `X-Powered-By`. **Fixed (2):** the API trusts loopback and private-network proxies (`TRUST_PROXY` overrides), so limits are per visitor. **Accepted (3):** the API is open source; the page shows routes, not data, and every route still needs its session |
| A06 | Vulnerable and outdated components | `pnpm audit --prod` | 9 critical and 49 high advisories, among them Next.js remote code execution in image optimisation, multer, body-parser, proxy-addr, undici, nodemailer, DOMPurify and ProseMirror | **Fixed**, with reviewed exceptions in build tooling: see [Dependencies](#dependencies). CI fails on any new high or critical advisory (`pnpm audit --prod --audit-level high`) |
| A07 | Identification and authentication failures | Sign-up closed after the first user (US-AUTH-08), single-use 1-hour password reset that never reveals whether an account exists (US-AUTH-09), Better Auth's sign-in limit (3 per 10 s per address), session revocation on deactivation, explicit 30-day session lifetime (rolling every 7 days; the phone app keeps its token in `expo-secure-store`). **Agents (US-MCP-03, D-257, D-258):** OAuth 2.1 authorization code with PKCE S256, tokens bound to the MCP address (`resource`), 15-minute access-token JWTs, https only. Every MCP call checks that the connection is live (disconnected, or unused for 30 days, ends it), the person is still an active member and Connected agents is on, then rate-limits to 120 calls a minute per connection | (1) No second factor. (2) Agents can register themselves without credentials (dynamic client registration, for agents that don't support Client ID Metadata Documents), so anyone can create a client with a name of their choosing | **Accepted for 1.0 (1):** passwords are Argon2id with a strength check and limited attempts; two-factor sign-in is on the roadmap. **Accepted (2):** registration is limited to 20 an hour per address; a client gets nothing until a signed-in person approves it on the consent page, which shows its name and address; and the person can disconnect it at any time |
| A08 | Software and data integrity failures | Release images built by CI from tags, `upgrade.sh` checking the release files against `SHA256SUMS`, frozen lockfile installs, the update check reading only GitHub Releases (US-OPS-06), migrations after a snapshot | None | Accepted (no change) |
| A09 | Logging and monitoring failures | Request logs with ids and redaction (US-OPS-07), the business audit log, the agent request log (US-MCP-08), failed-email and backup-age banners | None | Accepted (no change) |
| A10 | Server-side request forgery | Outbound requests: the AI provider (Owner-set base URL), a connecting agent's client metadata (D-257), S3 storage (`S3_ENDPOINT` from `.env`), the update check (fixed URL) | Agent metadata is the only URL an outsider can choose: Better Auth's CIMD transport accepts only public https addresses, pins the resolved address and never follows redirects. The AI base URL can point inside the network, but only an Owner can set it | Accepted (no change) |

### Connected agents and prompt injection

Text in records (an enquiry, a customer's message, a bank description) can carry instructions aimed at an agent. Spine tells agents to treat record text as data, but can't make them obey. **Accepted for 1.0:** an agent acts with the connecting person's rights and no more (A01), it can only read and create drafts that a person then checks, issues or sends in Spine, every call is logged with the tool and record (US-MCP-08), and the Owner can switch Connected agents off for everyone.

## Public routes

Every route that answers without a session:

| Route | Why it's safe |
|---|---|
| `GET /public/quotes/:token`, `POST …/accept`, `…/reject` | Signed token with a 24-byte random nonce; a guessed, malformed or tampered token gets the same 404 as any wrong one. 20 a minute per visitor |
| `GET /public/invitations/:id` | 32 random characters (about 190 bits); a guessed id gets the same 404. 20 a minute per visitor |
| `GET /public/password-reset/:token`, `GET /public/forgot-password` | The lookup shows the account's email only to someone holding the emailed, unexpired token, and doesn't use it up; the other only redirects to the web page. 20 a minute per visitor |
| `GET /public/signup-status` | Says only whether the first account still needs creating; sign-up is closed after the first user (US-AUTH-08) |
| `/api/auth/*` (Better Auth: sign-in, sign-up, password reset, OAuth authorize, token and register) | Sign-in limited to 3 per 10 s per address, reset requests never say whether an account exists, agent registration limited to 20 an hour per address (A07) |
| `GET /files/:id?exp=&sig=` | Only with a valid HMAC link of at most 5 minutes, issued after the record check; otherwise 401 or 403 |
| `GET /org/exports/:id/download` | Anyone who isn't an Owner of that organisation, signed out included, gets 404; links last 7 days; downloads are audited |
| `POST /mcp`, `/.well-known/oauth-*` | Discovery documents are public by design (RFC 8414, RFC 9728). `/mcp` checks the bearer token and the connection on every call (A07) |
| `GET /agent-consent/agent` | Reads only the query Better Auth signed for the sign-in and consent pages, checked against its secret; returns the agent's name and address |
| `GET /health…` | Status only, no data |

`apps/api/src/common/us-ops-18.http.integration.test.ts`:

- A guessed, malformed or tampered quote token gets the same 404 as any other wrong token, and a real one still works.
- A guessed invitation id gets the same 404.
- Quote and invitation lookups stop at 20 a minute per visitor (429), and another visitor isn't affected.
- Every API response carries the headers above.

## Dependencies

`pnpm audit --prod` first found 9 critical and 49 high advisories. After the fixes it reports none that aren't reviewed below, and CI fails on any new high or critical one (`pnpm audit --prod --audit-level high`, also a `pnpm verify` step). Re-run 2026-11-15: passes, with the 6 reviewed advisories below and 22 moderate ones (not a release blocker under NFR-SEC-04).

**Upgraded:** Next.js 15.5.22 → 15.5.28 (remote code execution in image optimisation, a Server Actions DoS), nodemailer 9 → 10.0.6 (address-parser DoS), Tiptap 3.29 → 3.30.5 and ProseMirror view 1.42.3 (paste XSS, Markdown ReDoS), DOMPurify 3.4.17, Vitest 2 → 3.2.7 with Vite 6.4. **Pinned with `pnpm.overrides`** to fixed versions in the same major line: body-parser, brace-expansion, compression, fast-uri, form-data (from the docs site's API reference), js-yaml, multer, nanoid, node-forge (1.4.3, 2026-11-14), postcss, proxy-addr, shell-quote, source-map-js and undici. The full API integration suite (1,357 tests on 2026-11-15), every unit suite and the E2E suite pass on the upgraded set.

**Accepted** (listed by id in `package.json` › `pnpm.auditConfig.ignoreGhsas`):

| Advisories | Package | Why it's accepted |
|---|---|---|
| GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr | tinypool 1.1 (Vitest's worker pool) | Test tooling. Vitest 3 still pins tinypool 1.x. It reaches the API image only because pnpm links better-auth's optional `vitest` peer; the API never imports it, and both need attacker-controlled worker options |
| GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr | image-size 1.2 | Expo/React Native build tooling (drizzle-orm's optional `expo-sqlite` peer); the fix is a major version those tools don't support yet |
| GHSA-mrhx-c7xc-m3w5 | zod 3.25 | Used by the Expo CLI only; Spine's own code uses zod 4.6 |
| GHSA-qr28-fpjm-wq7f | decode-uri-component 0.2 | expo-router's query parsing at build time; not in the API's runtime |

The six node-forge advisories accepted on 2026-11-04 were fixed by the 1.4.3 override and removed from the list on 2026-11-15, so a new node-forge advisory fails CI again. A follow-up keeps the rest out of the API image altogether (they're linked as optional peers of better-auth and drizzle-orm): [R-30](prd/13-risks-open-questions.md).

## Secret scan

gitleaks v8.24.3 over the whole history: 10 findings on 2026-11-04 (645 commits), all reviewed and accepted as not secrets. They are test passwords and session cookies in integration tests, a test push-subscription key, and the S3 driver reading its key from the environment. `.gitleaksignore` lists their fingerprints. Re-run 2026-11-15 over 678 commits: "no leaks found".

## ZAP baseline

ZAP 2.x baseline (`zap-baseline.py`, passive, ghcr.io/zaproxy/zaproxy:stable) against a running install, 2026-11-05: the web app (`/login`) and the API (`/health`). Not re-run on 2026-11-15: since then the only API change is the job-photo delete route (behind a session, reviewed under A01), and the rest is the public website and CI.

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
| Reviewed by | Claude Code, for the Owner (2026-11-04, refreshed 2026-11-15) |
| Signed off by the Owner | Hari Prasad |
| Date | 2026-11-15 |
