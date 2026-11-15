---
title: Install Spine
description: Run Spine on your own machine with Docker in about five minutes.
sidebar:
  order: 1
---

Spine runs on any Linux or macOS machine, or Windows with WSL2, that has **Docker 24 or newer with Compose 2.20 or newer**. Everything else — the database, the web app, the API and HTTPS — runs in containers. You don't need Node or a database installed.

## 1. Download the release

On the [releases page](https://github.com/haribrothers/spine/releases), open the newest release and download these files into one folder, for example `/opt/spine`: `install.sh`, `backup.sh`, `restore.sh`, `upgrade.sh`, `docker-compose.yml`, `Caddyfile` and `env.example` (and `SHA256SUMS` to check them). You don't need the `.apk`, which is the field app for Android, or `docker-compose.coolify.yml`, which is for [Coolify](../coolify/).

Or download them in a terminal, naming the newest release's tag:

```bash
mkdir -p /opt/spine && cd /opt/spine
v=v1.0.0-beta.3
for f in install.sh backup.sh restore.sh upgrade.sh docker-compose.yml Caddyfile env.example SHA256SUMS; do
  curl -fsSLO "https://github.com/haribrothers/spine/releases/download/$v/$f"
done
sha256sum --check --ignore-missing SHA256SUMS   # on macOS: shasum -a 256 --check --ignore-missing SHA256SUMS
chmod +x *.sh
```

The images are built for amd64 (Intel and AMD) and arm64 (Apple Silicon Macs, ARM servers) from `v1.0.0-beta.3`. Releases before it are amd64 only, so on an ARM machine they stop with "no matching manifest for linux/arm64": use a newer release.

## 2. Run the installer

```bash
./install.sh --app-url https://spine.example.com
```

Use the address people will open Spine at. Without `--app-url` it asks for it; `--non-interactive` uses `APP_URL` from the environment, or `http://localhost`.

To try Spine on your own computer, use `--app-url http://localhost`, or `http://<this computer's IP address>` to open it from other devices on your network. Caddy then serves plain HTTP and skips the certificate. That's fine for trying Spine out, but the field app and browser notifications need a real domain with HTTPS ([HTTPS and domains](../https-and-domains/)). A name like `http://spine.local` works only once it's in your computer's hosts file ([how](../https-and-domains/#only-on-your-network)).

### Port 80 already in use

Spine uses ports 80 and 443. If another program already has them (another web server, another Docker app), the start stops with "port is already allocated" or "address already in use". See what has the port with `sudo lsof -nP -iTCP:80 -sTCP:LISTEN`, and stop it, or give Spine another port:

```bash
./install.sh --app-url http://localhost --port 8080
```

Spine then opens at `http://localhost:8080`. The installer puts the port in the address and writes `docker-compose.override.yml`, which publishes that port instead of 80 and 443; Docker Compose reads it with `docker-compose.yml` every time, so backups and upgrades keep the port. A port in the address does the same (`--app-url http://localhost:8080`). This needs Compose 2.24.4 or newer. Another port is for your own computer or network: Let's Encrypt needs ports 80 and 443 to give a domain its certificate.

The installer:

1. checks Docker and Compose;
2. writes `.env` with the address, a random `AUTH_SECRET` and database password (an existing `.env` is never changed);
3. downloads Spine's images and starts it, waiting until it's healthy;
4. prints the address and the commands for logs, backups, upgrades and stopping.

The first start takes a minute or two while the images download and the database is set up.

### Your settings: `.env`

`.env` is Spine's settings file, in the folder you installed in. Its name starts with a dot, so `ls` hides it: `ls -a` shows it, and `grep APP_URL .env` shows the address. Docker Compose reads it every time Spine starts. Caddy answers only at `APP_URL`, and sign-in works only there.

Running `./install.sh` again keeps `.env` as it is ("Keeping your existing .env"), and `--app-url` and `--port` are left unused. To change the address, change `APP_URL` and `API_URL` together in `.env` (a new port also goes in `docker-compose.override.yml`), then run `docker compose --profile minimal up -d`. [Configuration](../configuration/) lists every setting.

`.env` holds Spine's secrets. Keep a copy somewhere safe, and never share it or commit it: restoring a backup on another machine needs the same `AUTH_SECRET`.

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
