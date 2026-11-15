---
title: Configuration
description: Every setting in .env, its default, and what happens without it.
sidebar:
  order: 2
---

Spine reads its settings from `.env` in the folder you installed it in. Only three are required, and `install.sh` writes all three. Everything else is optional and **degrades instead of failing**: without email settings, email waits in a queue; without push keys, browser notifications are hidden.

After changing `.env`, restart: `docker compose --profile minimal up -d`.

Most of what an Owner changes day to day — the business profile, tax, numbering, branding, modules, the AI assistant — is in the app under **Settings**, not here.

## Required

| Variable | What it is | Without it |
|---|---|---|
| `APP_URL` | The address people open Spine at, e.g. `https://spine.example.com`. Change `API_URL` with it; a port in it (`http://localhost:8080`) also goes in `docker-compose.override.yml` ([Another port](../https-and-domains/#another-port)) | Spine won't start |
| `AUTH_SECRET` | A long random secret for sessions and stored keys. `install.sh` generates it. **Keep a copy**: restoring a backup on a new machine needs the same one | Spine won't start |
| `DATABASE_URL` | The Postgres connection, `postgres://spine:<password>@db:5432/spine` | Spine won't start |

## Install

| Variable | Default | What it does |
|---|---|---|
| `POSTGRES_PASSWORD` | set by `install.sh` | The database's password; keep it the same as in `DATABASE_URL` |
| `API_URL` | `<APP_URL>/api` | Where the API is reached from outside (sign-in links, the address for AI agents) |
| `SPINE_VERSION` | the release's version | Which images to run; `upgrade.sh` sets it |
| `SITE_ADDRESS` | `APP_URL` | What Caddy serves. Set `:80` when another proxy in front handles HTTPS (see [HTTPS and domains](../https-and-domains/)) |
| `TRUSTED_PROXIES` | `127.0.0.1/32` | Proxies in front of Caddy whose `X-Forwarded-For` it believes, e.g. `private_ranges` |
| `TRUST_PROXY` | loopback and private networks | Proxies the API believes about a visitor's address, so rate limits count each visitor; `false` if nothing is in front of the API |
| `CLOUDFLARE_TUNNEL_TOKEN` | — | Remote access through a Cloudflare Tunnel (`--profile full`) |

## Email

| Variable | Default | Without it |
|---|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | port `587` | Documents still issue; emails wait in the queue and send once these are set. See [Email](../email/) |

## Files

| Variable | Default | What it does |
|---|---|---|
| `STORAGE_DRIVER` | `local` | `local` keeps files on the `spine_files` volume; `s3` uses an S3-compatible bucket. See [File storage](../file-storage/) |
| `FILES_DIR` | `/data/files` | Where the local driver keeps files inside the API container |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION` | bucket `spine`, region `us-east-1` | The bucket for the `s3` driver. Without them, uploads are unavailable on `s3` |

## Backups

| Variable | Default | What it does |
|---|---|---|
| `BACKUP_PASSPHRASE` | — | Encrypts every backup (AES-256) without asking. Without it, `backup.sh --passphrase` asks |
| `BACKUP_REMOTE` | — | An S3-compatible bucket each encrypted backup is copied to, e.g. `s3://my-bucket/spine` (keeps 7 daily and 4 weekly) |
| `BACKUP_REMOTE_ENDPOINT`, `BACKUP_REMOTE_REGION`, `BACKUP_REMOTE_ACCESS_KEY`, `BACKUP_REMOTE_SECRET_KEY` | — | That bucket's address and keys |
| `SNAPSHOTS_DIR` | `/data/snapshots` | Where the API keeps a database snapshot before each upgrade's migrations (the last three) |

## Defaults for a new business

| Variable | Default | What it does |
|---|---|---|
| `CURRENCY` | `USD` | The currency a new business starts with (changeable in onboarding) |
| `LOCALE` | `en-US` | Number and date formatting a new business starts with |
| `TZ` | `UTC` | The server's time zone, for scheduled jobs |
| `SEED_DEMO` | `false` | `true` or `<country>:<industry>` loads a demo business on the very first start, into an empty database only |

## Notifications and the field app

| Variable | Default | Without it |
|---|---|---|
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | — | Browser push notifications are hidden; the in-app bell and emails still work. Generate keys with `npx web-push generate-vapid-keys` |
| `MOBILE_MIN_VERSION` | — (any version) | The oldest field app the server accepts; an older one asks to be updated |

## Operations

| Variable | Default | What it does |
|---|---|---|
| `UPDATE_CHECK` | on | `off` stops the daily check for a new release (no request is made) |
| `LOG_FORMAT` | `json` in the images | `json` or readable lines |
| `LOG_REQUESTS` | `on` | `off` stops the one-line-per-request log |
| `MIGRATE_ON_START` | `true` | `false` leaves database migrations to you |
| `DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT` | the driver's defaults | Database connection pool size and idle seconds |
