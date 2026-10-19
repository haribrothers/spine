# 22 · Connected agents (MCP)

Lets people use Spine from the AI agents they already use — Claude, ChatGPT, Claude Code, Cursor and any other client that speaks the Model Context Protocol (MCP). Spine runs an MCP server inside its own API. A person connects their agent once, approves what it may do, and can then ask it about their business ("who owes us money?", "how is the Harbour Road job doing?") or have it start work ("draft a quote for the deck repair from this email"). The agent works as that person, with that person's role and Team rights, and never more ([D-256](../prd/12-decisions.md)).

It's off until an Owner switches it on. Agents read, and they create drafts — leads, quotes, vendor bills and notes — for a person to check and finish in Spine. They never issue, send, record, void, match or post anything, and never change settings, users or tax ([D-256](../prd/12-decisions.md), [D-166](../prd/12-decisions.md)). It doesn't use Spine's own AI assistant (21): the agent's AI is whatever the person connected, paid for by them, and Spine's AI switch, provider and budget don't apply.

**Screens:** `SettingsConnectedAgents` (P1), `SettingsConnectedAgentsDark` (P1), `SettingsConnectedAgentsTurnOnConfirm` (P1), `AgentConsent` (P1), `AgentConsentDark` (P1), `AgentConsentSignIn` (P1), `MyConnectedAgents` (P1), `MyConnectedAgentsDisconnectConfirm` (P1), `AuditLogAgent` (P2), `QuoteActivityAgent` (P2) — to be drawn before the build, as Phase 10's were ([D-242](../prd/12-decisions.md)).
**Depends on:** 02 Auth (Better Auth, sessions, password reset), 15 Team (roles, Teams, capabilities, audit log, deactivation), 16 Settings (grouped Settings, Your account, Modules — D-154, D-236), 18 Ops (rate limits, idempotency, Caddy), and the read and draft services of 03 CRM, 05 Catalogue, 06 Quotes, 07 Jobs, 08 Invoicing, 09 Payments, 10 Purchases, 12 Reports and 20 Banking.

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-MCP-01 | Sign-in for agents: Better Auth 1.7, OAuth 2.1, consent | P1 | 11 | `AgentConsent`, `AgentConsentDark`, `AgentConsentSignIn` |
| F-MCP-02 | Connected agents set-up and connections | P1 | 11 | `SettingsConnectedAgents`, `SettingsConnectedAgentsDark`, `SettingsConnectedAgentsTurnOnConfirm`, `MyConnectedAgents`, `MyConnectedAgentsDisconnectConfirm` |
| F-MCP-03 | Agent tools: find, read, report, draft | P1 | 11 | `QuoteActivityAgent` |
| F-MCP-04 | Agent requests in the audit log | P2 | 11 | `AuditLogAgent` |

## Shared rules

These hold for every tool below, so the stories don't repeat them:

- **As the person, never more.** Every tool call runs as the person who connected the agent: their role, their Teams' rights, Field's fixed rules, ownership (own/others) and the modules that are on. Tools call the same services as the web app, with the same checks, in the same order (ownership before status). A tool the person couldn't use in Spine isn't listed to their agent, and calling it anyway answers "You don't have permission to …" ([07-security](../prd/07-security.md)).
- **Two scopes, narrower only.** A connection has `spine:read` and, if the person allowed it, `spine:draft`. Scopes can only narrow what the person may do; they never widen it.
- **Drafts only.** Draft tools create records in their draft or open state through the normal create routes, with Spine computing every total and tax from the inputs ([D-166](../prd/12-decisions.md)). Each answer includes the record's link so the person opens it, checks it and issues, sends or records it themselves — with that screen's own confirm ([D-218](../prd/12-decisions.md)).
- **Marked.** Every record an agent creates says so in its Activity: "Created as a draft · via <agent> for <person>".
- **What the agent gets.** Amounts come both formatted ("$1,250.00") and as minor units with a currency code; dates as `YYYY-MM-DD`; every record with its number, status and its Spine link (`APP_URL/...`). Lists return at most 100 rows a page with a cursor. Never returned: provider keys or any secret, password hashes, session or reset tokens, other people's sessions, or anything the person can't open in Spine.
- **Customer text is data.** Notes, enquiries, emails and statement descriptions come back as field values marked as text from people outside the business. Tools take typed, validated arguments only (ids, numbers, dates, enums, short text with length limits), so text inside a record can't make Spine do anything a tool doesn't already do.
- **Plain errors.** A tool that can't do something says why and what to do next ("Invoice INV-0042 isn't a draft, so it can't be changed. Open it in Spine to credit it."), never a stack trace or an internal id.

## User stories

### US-MCP-01 · Move Spine to Better Auth 1.7 with nobody noticing
**Feature:** F-MCP-01 · **Priority:** P1 · **Phase:** 11 · **Screens:** —
**As** a maintainer, **I want** Spine on Better Auth 1.7 before agents sign in, **so that** the OAuth provider, CIMD and MCP plugins we need are the supported ones.

Decision: D-257

**Acceptance criteria**
- **Given** an install on 1.6 with people signed in on the web and the phone, **when** it upgrades, **then** nobody is signed out: web cookies and phone Bearer sessions keep working, and migrations only add tables and columns.
- **Given** the upgrade, **when** the auth tests run, **then** every existing sign-up, invite-only, invitation, password (Argon2id, common-passwords), reset (one hour, single use, signs everyone out), session lifetime, organisation, active-organisation, deactivated-member (`ACCESS_REMOVED`), 401-not-403 and rate-limit test passes unchanged.
- **Given** the field app, **when** a Field user signs in and out on iOS and Android (Maestro), **then** it works as before, with the Expo client on its 1.7 line.
- **Given** the JWKS the `jwt()` plugin already keeps, **when** 1.7 starts, **then** it keeps using it (no key rotation forced by the upgrade).

**Implementation notes**
- `better-auth`, `@better-auth/expo` and `@better-auth/cli` move to 1.7.x in one commit, with the 1.6 → 1.7 migration notes applied and the generated migration reviewed. Nothing user-visible changes; this is its own story so the auth change ships on its own, tested, before anything is built on it.

### US-MCP-02 · Switch connected agents on or off
**Feature:** F-MCP-02 · **Priority:** P1 · **Phase:** 11 · **Screens:** `SettingsConnectedAgents`, `SettingsConnectedAgentsDark`, `SettingsConnectedAgentsTurnOnConfirm`
**As** an owner, **I want** one switch for outside AI agents, **so that** I decide whether anyone can use Spine from Claude, ChatGPT or another agent.

Decision: D-256, D-258

**Acceptance criteria**
- **Given** an Owner opens Settings, **when** the list shows, **then** "Connected agents" sits in the Business group after "AI assistant", and searching settings for "MCP", "agent", "Claude" or "ChatGPT" finds it. Staff and Field don't see it.
- **Given** a new install, **when** the pane opens, **then** the switch is off and the pane reads "Let people use Spine from AI agents like Claude and ChatGPT. Each person connects their own agent and approves what it can do. Agents can read and create drafts — they never issue, send, record or delete anything.".
- **Given** I switch it on, **when** "Turn on connected agents?" asks first ("People will be able to connect AI agents to Spine. An agent sees what the person who connected it can see, and sends it to that agent's AI provider."), **then** confirming saves it, records it in the audit log and the toast says "Connected agents are on".
- **Given** it's on, **when** the pane shows, **then** it shows the connector address to copy (`<APP_URL>/api/mcp`) with "Copy", a short "How to connect" for Claude, ChatGPT and Claude Code, a switch "Agents can create drafts" (on by default), and every connection in the business (US-MCP-04).
- **Given** `APP_URL` isn't `https` (and isn't `localhost`), **when** the pane shows, **then** it says "Claude and ChatGPT on the web can only connect to an https address they can reach from the internet. Agents on this network, like Claude Code, can still connect." — and the switch still works.
- **Given** it's on, **when** I switch it off, **then** "Turn off connected agents?" asks first ("Every connected agent stops working at once. Connections are kept for when you turn this back on.") and the toast says "Connected agents are off".
- **Given** it's off, **when** an agent calls Spine, **then** `/api/mcp` answers 403 `MODULE_OFF` with "Connected agents are turned off for <Business>. Ask an Owner to turn them on.", the consent page says the same, no agent can be connected, and `Settings › Your account › Connected agents` is hidden.
- **Given** "Agents can create drafts" is off, **when** an agent lists its tools, **then** no draft tool is listed and calling one answers that drafts are turned off.
- **Given** a Staff user, **when** they call `GET/PUT /org/agents`, **then** the API returns 403.

**Implementation notes**
- The sixth module (`agents` in `packages/shared/src/modules.ts`, D-154): it owns `/mcp`, `/agents/*` and the consent page, and, like AI, is switched in its own pane, not in Settings › Modules (which lists it with its state and "Set up in Connected agents"). `settings.agents` `{ enabled, drafts }`. API: `GET/PUT /org/agents` (roles: owner).

### US-MCP-03 · Connect an AI agent to Spine
**Feature:** F-MCP-01 · **Priority:** P1 · **Phase:** 11 · **Screens:** `AgentConsent`, `AgentConsentDark`, `AgentConsentSignIn`
**As** anyone who works in Spine, **I want** to connect my AI agent with my own Spine sign-in, **so that** it can help me without me sharing a password or key.

Decision: D-256, D-257, D-258

**Acceptance criteria**
- **Given** Connected agents is on, **when** I add `<APP_URL>/api/mcp` as a connector in Claude, ChatGPT or Claude Code, **then** the agent finds how to sign in by itself (protected-resource metadata, then the authorization server's metadata) and opens Spine's sign-in in my browser; I paste nothing but the address.
- **Given** I'm not signed in to Spine, **when** the browser opens, **then** I sign in on Spine's usual signed-out frame (`AgentConsentSignIn`) and come back to the consent page; I'm never asked for my password anywhere but Spine.
- **Given** the consent page, **when** it shows, **then** it reads "<Agent> wants to use Spine as you" with the agent's address (the host its sign-in returns to, e.g. `claude.ai`), my name and the business, and lists in plain words what it can do: "Read what you can see in Spine — contacts, quotes, jobs, invoices, bills and the reports you can open" and, with drafts allowed, a checkbox "Create drafts for you to check — leads, quotes, vendor bills and notes" (on). It also says what it can't: "It can't issue, send, record payments, delete or change settings." and "What it reads is sent to <Agent>'s AI provider."
- **Given** an agent that registered itself without a verifiable address, **when** the consent page shows, **then** its name carries "Unverified name" and the page leads with the host it returns to.
- **Given** I press "Allow", **when** the agent finishes signing in, **then** the agent can call Spine as me, the connection is in my list (US-MCP-04) and the audit log has "Connected <Agent>". "Cancel" sends the agent back with nothing.
- **Given** a Field user, **when** they connect, **then** the page lists only what Field can do ("Read your assigned jobs, contacts and the catalogue · Add notes to your jobs") and never mentions money or reports.
- **Given** a request that doesn't follow the rules — no PKCE (S256), a `resource` other than Spine's MCP address, a redirect address the agent didn't declare, or an expired or replayed code — **when** it reaches Spine, **then** it's refused with the OAuth error and nothing is connected.
- **Given** a token issued for anything other than Spine's MCP address, or one from somewhere else, **when** it's sent to `/api/mcp`, **then** Spine answers 401 with `WWW-Authenticate` pointing at its metadata; it never passes a token on to anything.
- **Given** a deactivated member, or one whose password was reset, **when** their agent calls Spine, **then** every connection they had is ended and the call answers 401; reactivating doesn't restore them — they connect again.

**Implementation notes**
- Better Auth 1.7 `oauthProvider()` with `@better-auth/cimd` (Client ID Metadata Documents, preferred) and dynamic client registration kept for agents without CIMD (D-257). Authorization server at `<APP_URL>/api/auth`; `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server/api/auth` are routed to the API by Caddy. Consent page: web `/oauth/consent`, signed query verified server-side before `oauth2.consent`.

### US-MCP-04 · See and disconnect connected agents
**Feature:** F-MCP-02 · **Priority:** P1 · **Phase:** 11 · **Screens:** `MyConnectedAgents`, `MyConnectedAgentsDisconnectConfirm`, `SettingsConnectedAgents`
**As** anyone who works in Spine, **I want** to see the agents I've connected and disconnect one, **so that** I stay in control of what can act as me. **As** an owner, **I want** to see and end anyone's connection.

Decision: D-258

**Acceptance criteria**
- **Given** Settings › Your account › Connected agents, **when** it opens, **then** each of my connections shows the agent's name and address, what it may do ("Read" or "Read and create drafts"), when I connected it and when it was last used; with none, "No agents connected. Add <APP_URL>/api/mcp as a connector in Claude, ChatGPT or another agent." with "Copy address".
- **Given** a connection, **when** I choose "Disconnect", **then** "Disconnect <Agent>?" asks first ("It stops working at once. Drafts it created stay.") and the toast says "<Agent> disconnected"; its next call answers 401.
- **Given** the Owner's pane, **when** it lists every connection, **then** each row names the person, and an Owner can disconnect anyone's with the same confirm; the person is notified "<Owner> disconnected <Agent> from your account."
- **Given** a person is removed, deactivated or has their password reset, **when** that happens, **then** their connections end and leave the lists.
- **Given** a connection unused for 30 days, **when** its agent tries to refresh, **then** it's ended and the agent has to connect again.

**Implementation notes**
- A connection is one person's consent for one agent (Better Auth's `oauthConsent`) plus Spine's `agent_connections` row (last used, ended). Access tokens are short-lived JWTs (15 minutes, audience = the MCP address) and every MCP request also checks the connection, the member and the module, so disconnecting is immediate even though a JWT can't be revoked (D-258). API: `GET /agents/connections`, `DELETE /agents/connections/:id` (any member, their own), `GET /org/agents/connections`, `DELETE /org/agents/connections/:id` (roles: owner).

### US-MCP-05 · Ask an agent to find and read records
**Feature:** F-MCP-03 · **Priority:** P1 · **Phase:** 11 · **Screens:** —
**As** anyone who works in Spine, **I want** my agent to find and read what I can see, **so that** I can ask about customers, quotes, jobs and invoices in my own words.

Decision: D-259

**Acceptance criteria**
- **Given** a connection with `spine:read`, **when** the agent lists tools, **then** it gets `search`, `list_records` and `get_record` — each marked read-only — with descriptions that say what they return.
- **Given** `search` with words, **when** it runs, **then** it returns what Spine's search returns for me (contacts by name, phone, tax ID or person; documents by number or amount; leads, jobs, catalogue items) in the areas whose modules are on.
- **Given** `list_records` for contacts, leads, quotes, jobs, invoices, credit notes, payments, vendor bills, vendor credits, vendor payments, expenses or catalogue items, with filters (status, contact, job, date range, overdue), **when** it runs, **then** it returns that list as I'd see it in Spine, newest first, 25 by default and at most 100 a page.
- **Given** `get_record` with a type and an id or document number, **when** it runs, **then** it returns the record as its page shows it — lines, tax, totals, balance, status, dates and its link — and 404 "No quote Q-0099 that you can open." for anything I can't open.
- **Given** a Field user, **when** their agent reads, **then** it gets only contacts, the catalogue and the jobs they're assigned to, without money (US-JOB-19), and their own expenses; every other type isn't listed.
- **Given** a Staff member whose Teams can't open invoices, **when** their agent asks for invoices, **then** the type isn't offered and a direct call answers "You don't have permission to open invoices."

**Implementation notes**
- One handler per record type over the module's existing list/get service, with the caller's `Principal`; no new queries that bypass a service. Tool input and output schemas are built from the shared zod schemas.

### US-MCP-06 · Ask an agent who owes us and how the business is doing
**Feature:** F-MCP-03 · **Priority:** P1 · **Phase:** 11 · **Screens:** —
**As** an owner or office staff, **I want** my agent to read Spine's reports, **so that** I can ask about money owed, cash and profit without opening reports.

Decision: D-259

**Acceptance criteria**
- **Given** the right report capability, **when** the agent lists tools, **then** it gets those that match: `receivables` (aging buckets, overdue invoices by customer — `reports.view_receivables`), `payables` (`reports.view_payables`), `profit_and_loss` and `balance_sheet` for a period (`reports.view_financial_statements`), `job_profitability` (`reports.view_job_profitability`), `bank_balances` (`banking.view`) and `dashboard_summary` (`reports.view_dashboard_summary`).
- **Given** any of them, **when** it answers, **then** the figures are exactly the report's in Spine for the same period and basis (cash or accrual) — they come from the same report service, from journal lines, never a separate calculation.
- **Given** Field, or Staff without the capability, **when** their agent lists tools, **then** those report tools aren't there, and a direct call answers 403 — Field never gets a money figure (security rule).

### US-MCP-07 · Have an agent start work as drafts
**Feature:** F-MCP-03 · **Priority:** P1 · **Phase:** 11 · **Screens:** `QuoteActivityAgent`
**As** anyone who works in Spine, **I want** my agent to create drafts for me, **so that** it does the typing and I check and finish the work in Spine.

Decision: D-256, D-259

**Acceptance criteria**
- **Given** a connection with `spine:draft` and drafts on, **when** the agent lists tools, **then** it gets those I'm allowed: `create_lead` (with the enquiry as its first note, adding the contact if it's new — `leads.edit_own`, `contacts.edit_own`), `draft_quote` (`quotes.edit_own`), `draft_vendor_bill` (`vendor_bills.edit_own`) and `add_note` (to a contact, lead or job I can change — Field only on their assigned jobs).
- **Given** `draft_quote` with a customer and lines naming catalogue items or free text with quantities and prices, **when** it runs, **then** a draft quote is created through the normal route: catalogue items take their catalogue price and tax unless a price is given, Spine computes tax and totals, and the answer has the quote's number, total and link with "Open it in Spine to check and send it.".
- **Given** `draft_vendor_bill`, **when** it runs, **then** a draft bill is created the same way; it's never recorded, so nothing posts to the ledger.
- **Given** any draft tool, **when** it would do anything but create a draft or add a note — issue, send, record, approve, void, match, delete, or change an existing record — **then** there's no tool for it: the server has no such tool and a route-introspection test checks the tools call only the allowed create services.
- **Given** an agent repeats the same call (a retry), **when** Spine sees it again, **then** it returns the first result and creates nothing twice (Idempotency-Key from the connection and the call).
- **Given** a created record, **when** I open its Activity, **then** the first entry reads "Created as a draft · via <Agent> for <person>", and the record is mine, as if I'd made it.
- **Given** more than 30 drafts from one connection in an hour, **when** the agent tries another, **then** it's told "Too many drafts from this agent. Try again later." (rate limit).

**Implementation notes**
- Expenses aren't a draft tool: an expense has no draft state — it's submitted when created, and with Approvals off it's approved and posted at once (D-154), so an agent creating one would record money (D-259).

### US-MCP-08 · See every agent request in the audit log
**Feature:** F-MCP-04 · **Priority:** P2 · **Phase:** 11 · **Screens:** `AuditLogAgent`
**As** an owner, **I want** a record of what agents did as whom, **so that** I can check how they're used.

Decision: D-258

**Acceptance criteria**
- **Given** Team › Audit log, **when** I choose the record type "Agent request", **then** each row shows when, who, the agent, the tool ("Searched", "Read a quote", "Read receivables", "Drafted a quote"…), the record it touched (opens it) and whether it succeeded, was refused or was rate-limited.
- **Given** an agent request, **when** it's logged, **then** the arguments' text and the result aren't stored — only the tool, the record and the outcome.
- **Given** connecting, disconnecting and switching agents on or off, **when** I look in the audit log, **then** each is there.
- **Given** one connection makes more than 120 calls in a minute, **when** it calls again, **then** it's told to slow down (429 with `Retry-After`), and the session limit (D-124) still applies to the person.

**Implementation notes**
- Data: `agent_requests` (new; like `ai_requests`, D-169), audit entity type `agent_request`; the audit log's `via` column names the agent on entries made through it.

### US-MCP-09 · Start from a ready-made task
**Feature:** F-MCP-03 · **Priority:** P3 · **Phase:** 11 · **Screens:** —
**As** anyone who works in Spine, **I want** a few ready-made tasks in my agent, **so that** I don't have to work out how to ask.

Decision: D-259

**Acceptance criteria**
- **Given** an agent that shows MCP prompts, **when** it lists them, **then** it offers those my tools allow: "Chase overdue invoices" (reads receivables and drafts nothing — it suggests what to send, for me to send from Spine), "Summarise a job" and "This week in the business".
- **Given** a prompt, **when** it runs, **then** it uses only the tools above, as me.
