---
title: Install Spine
description: Run Spine on your own machine with Docker in about five minutes.
sidebar:
  order: 1
---

Spine runs on any Linux or macOS machine, or Windows with WSL2, that has **Docker 24 or newer with Compose 2.20 or newer**. Everything else — the database, the web app, the API and HTTPS — runs in containers. You don't need Node or a database installed.

## 1. Download the release

On the [releases page](https://github.com/haribrothers/spine/releases), open the newest release and download these files into one folder, for example `/opt/spine`: `install.sh`, `backup.sh`, `restore.sh`, `upgrade.sh`, `docker-compose.yml`, `Caddyfile` and `env.example` (and `SHA256SUMS` to check them). You don't need the `.apk`, which is the field app for Android, or `docker-compose.coolify.yml`, which is for [Coolify](../coolify/).

With the [GitHub CLI](https://cli.github.com/), name the newest release's tag, for example `v1.0.0-beta.2` (without a tag, `gh` only finds full releases, not betas):

```bash
mkdir -p /opt/spine && cd /opt/spine
gh release download v1.0.0-beta.2 --repo haribrothers/spine \
  -p '*.sh' -p docker-compose.yml -p Caddyfile -p env.example -p SHA256SUMS
sha256sum --check --ignore-missing SHA256SUMS   # on macOS: shasum -a 256 --check --ignore-missing SHA256SUMS
chmod +x *.sh
```

## 2. Run the installer

```bash
./install.sh --app-url https://spine.example.com
```

Use the address people will open Spine at. Without `--app-url` it asks for it; `--non-interactive` uses `APP_URL` from the environment, or `http://localhost`.

To try Spine on your own computer, use `--app-url http://localhost`, or `http://<this computer's IP address>` to open it from other devices on your network. Caddy then serves plain HTTP and skips the certificate, and port 80 must be free. That's fine for trying Spine out, but the field app and browser notifications need a real domain with HTTPS ([HTTPS and domains](../https-and-domains/)).

The installer:

1. checks Docker and Compose;
2. writes `.env` with a random `AUTH_SECRET` and database password (an existing `.env` is never changed);
3. downloads Spine's images and starts it, waiting until it's healthy;
4. prints the address and the commands for logs, backups, upgrades and stopping.

The first start takes a minute or two while the images download and the database is set up.

## 3. Create the first account

Open the address. With no accounts yet, Spine shows a welcome page: create your account. **The first person to sign up owns the business** (the Primary Owner). After that, sign-up closes: everyone else joins by an invitation from an Owner.

Onboarding then asks for your business details, country and tax, currency, financial year and document numbering. You can skip any step and come back to it in Settings.

:::tip[Try it with sample data]
Set `SEED_DEMO=true` in `.env` before the first start to load a demo business (Riverstone Builders, a US contractor), or `SEED_DEMO=IN:interior_design` for an Indian interior design studio. The first person to sign up owns it. Delete the demo later in **Settings › Data**.
:::

## 4. Issue your first invoice

1. **Contacts › Add contact**: add a customer.
2. **Invoices › New invoice**: pick the customer, add a line, and **Save draft**.
3. **Issue invoice**: it gets its permanent number and posts to your books.

## What's running

| Service | What it does |
|---|---|
| `db` | PostgreSQL 16, on the `spine_db` volume |
| `api` | The API, with your files on the `spine_files` volume |
| `web` | The web app |
| `caddy` | Serves both on your address and gets the HTTPS certificate |

Stop Spine with `docker compose --profile minimal down` and start it again with `./install.sh` (it keeps your `.env`).

:::caution[Never add -v]
`docker compose down -v` deletes the database and every stored file. Use `docker compose down` to stop Spine.
:::

## Next

- [Configuration](../configuration/): every setting in `.env`.
- [Email](../email/): send quotes, invoices and invitations.
- [Backups and restore](../backups/): set this up before you rely on Spine.
- [HTTPS and domains](../https-and-domains/).
