---
title: Troubleshooting
description: The health check, the logs, the email log, and the most common problems with what to do.
sidebar:
  order: 9
---

## Is it running?

```bash
docker compose ps
curl -s https://spine.example.com/api/health/ready
```

`/api/health/ready` answers `200` once the database and the job queue answer, with the storage status. `/api/health` answers as soon as the API is up.

## The logs

```bash
docker compose logs -f api        # the API: requests, migrations, emails, jobs
docker compose logs -f web caddy  # the web app and the front door
```

Every request is logged with an id. When Spine shows **Something went wrong on our side**, the page's **Error reference** is that id: search the API log for it. Passwords, tokens, cookies and card or bank numbers are never written to the logs.

## Emails

Owners open **Settings › Team › Email log** to see every email with its status and error; see [Email](../email/).

## Common problems

| What you see | What to do |
|---|---|
| `install.sh` says Docker or Compose is too old | Install Docker 24+ with Compose 2.20+ (`docker compose version`) |
| The address doesn't open, or the certificate fails | Check the DNS record points at this machine and ports 80 and 443 are open; `docker compose logs caddy` says why |
| "Spine won't start" in the API log after an upgrade | A migration failed and nothing changed. The log names the snapshot; go back to the previous `SPINE_VERSION` in `.env` and start, or restore the backup `upgrade.sh` made, then report the error |
| Emails stay queued | `SMTP_*` aren't set, or are wrong; the email log shows the error |
| Uploads fail | The disk is full (Owners see a banner above 85%), or the `s3` driver's settings are wrong |
| "This Spine is invite-only" on sign-up | Expected: only the first person can sign up. Ask an Owner for an invitation |
| Lost the only Owner's password | **Forgot password** on the login page sends a reset link (email must work) |
| The field app says "Update Spine to keep going" | The server's `MOBILE_MIN_VERSION` is newer than the app; update it from the store |
| A restore says the backup's secret doesn't match | Put the old install's `AUTH_SECRET` in `.env`, or add `--new-secret` |

## Still stuck?

[Open an issue](https://github.com/haribrothers/spine/issues/new/choose) with your version (Settings › About Spine), what you did, and the relevant log lines with anything private removed.
