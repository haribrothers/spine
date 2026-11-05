---
title: Using the API
description: Authentication, idempotency and errors — the conventions every route follows.
sidebar:
  order: 6
---

Spine's web app and field app use the same REST API, and so can your own scripts. Every route is under `/api` on your Spine's address (`https://spine.example.com/api/…`). The [API reference](../../api/) lists every operation, generated from the API's OpenAPI document; the full contract is [05-api](https://github.com/haribrothers/spine/blob/main/docs/prd/05-api.md).

## Authentication

Sign in with Better Auth's email and password route, then send the session with each request:

```sh
curl -c cookies.txt -X POST https://spine.example.com/api/auth/sign-in/email \
  -H "Content-Type: application/json" -H "Origin: https://spine.example.com" \
  -d '{ "email": "you@example.com", "password": "…" }'
curl -b cookies.txt https://spine.example.com/api/invoices
```

The field app sends the session token as `Authorization: Bearer <token>` instead of the cookie; both work. A request without a valid session gets **401**. What a request may do depends on the member's role (Owner, Staff or Field) and, for Staff, their Teams' rights — each operation in the reference says which. The server checks every request; nothing the client says about its role is trusted.

## Idempotency

Every request that changes something (`POST`, `PUT`, `PATCH`, `DELETE`) must carry an `Idempotency-Key` header: a fresh UUID for each action.

- The first request with a key does the work and stores the answer.
- Repeating it with the same key returns that stored answer instead of doing it again, so a retry after a dropped connection never issues an invoice or records a payment twice.
- A second request with the same key while the first is still running gets **409**.

Keys are per user and per path. A few read-only routes that are `POST` because of their body (PDF previews, AI suggestions) don't need one.

## Errors

| Status | When |
|---|---|
| 400 | Validation failed, or a business rule was broken. `message` says what to change, e.g. "This quote's discount requires owner approval before it can be sent". |
| 401 | No session, or it has expired. |
| 403 | The role, Team rights or ownership don't allow it; the module is switched off (`error: "MODULE_OFF"`); or the person's access was removed (`error: "ACCESS_REMOVED"`). |
| 404 | No such record in this business. |
| 409 | The same Idempotency-Key is still being handled, or the record conflicts with one that exists. |
| 413 | An upload over 10 MB. |
| 426 | A field app older than the server accepts (`error: "CLIENT_TOO_OLD"`). |
| 429 | Too many requests to a public route (20 a minute per visitor). |
| 500 | Something went wrong on the server; `requestId` is in the response and the server's log. |

Errors are JSON: `{ "statusCode": 400, "message": "…", "error": "…" }`.

## Money and dates

Amounts are integer minor units in strings (`"125000"` is 1,250.00) with a currency code; dates are ISO `YYYY-MM-DD`.
