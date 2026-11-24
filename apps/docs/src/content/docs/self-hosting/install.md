---
title: Install Spine
description: Run Spine on your own machine with Docker in about five minutes.
sidebar:
  order: 1
---

Spine runs on any Linux or macOS machine, or Windows with WSL2, that has **Docker 24 or newer with Compose 2.20 or newer**. Everything else — the database, the web app, the API and HTTPS — runs in containers. You don't need Node or a database installed.

## 1. Download the release

On the [releases page](https://github.com/haribrothers/spine/releases), open the newest release and download these files into one folder, for example `/opt/spine`: `install.sh`, `backup.sh`, `restore.sh`, `upgrade.sh`, `docker-compose.yml` and `env.example` (and `SHA256SUMS` to check them). You don't need the `.apk`, which is the field app for Android, `docker-compose.coolify.yml`, which is for [Coolify](../coolify/), or `docker-compose.panels.yml`, which is for [Docker panels](../docker-panels/).

Or download them in a terminal, naming the newest release's tag:

```bash
mkdir -p /opt/spine && cd /opt/spine
v=v1.0.0-beta.7
for f in install.sh backup.sh restore.sh upgrade.sh docker-compose.yml env.example SHA256SUMS; do
  curl -fsSLO "https://github.com/haribrothers/spine/releases/download/$v/$f"
done
sha256sum --check --ignore-missing SHA256SUMS   # on macOS: shasum -a 256 --check --ignore-missing SHA256SUMS
chmod +x *.sh
```

The images are built for amd64 (Intel and AMD) and arm64 (Apple Silicon Macs, ARM servers) from `v1.0.0-beta.3`. Releases before it are amd64 only, so on an ARM machine they stop with "no matching manifest for linux/arm64": use a newer release.

## 2. Run the installer

```bash
./install.sh
```

Spine opens on one port, **7746**, at any address: `http://localhost:7746` on the machine itself, and `http://<its IP address>:7746` from every other device on your network. That's plain HTTP, with no redirect to HTTPS.

The installer asks for one more thing: **the address Spine writes into links**, in emailed quotes and invoices, invitations, password resets and PDFs, and the address AI agents connect to. It suggests this machine's IP, for example `http://192.168.1.20:7746`, because a link to `localhost` only opens on this machine. Reserve that IP for the machine in your router, so it doesn't change and break links you've already sent. `--non-interactive` asks nothing: it uses `APP_URL` from the environment, or `http://localhost:7746`.

| Where Spine runs | Command |
|---|---|
| Your computer or office network | `./install.sh` (or `--app-url http://192.168.1.20`) |
| Port 7746 is taken | add `--port 8080` |
| A server with a domain | `./install.sh --app-url https://spine.example.com` |
| Behind Tailscale, a Cloudflare Tunnel or your own proxy | `./install.sh --app-url https://<its address> --behind-proxy` |
| From Portainer, Dockge, Synology, TrueNAS, Dokploy or Easypanel | No installer: paste `docker-compose.panels.yml` ([Docker panels](../docker-panels/)) |
| From Runtipi | Spine's own app store ([Docker panels › Runtipi](../docker-panels/#runtipi)) |

**With a domain**, Caddy also takes ports 80 and 443 and gets the domain's HTTPS certificate from Let's Encrypt. The installer writes `docker-compose.override.yml` for those two ports, and keeps port 7746 to the machine itself (`127.0.0.1:7746`). **Behind something that already handles HTTPS**, Spine stays on its port, and you point that proxy, tunnel or Tailscale at it ([HTTPS and domains](../https-and-domains/)). The field app and browser notifications need HTTPS; for HTTPS without a domain, [use Tailscale](../https-and-domains/#https-without-a-domain-tailscale).

A name like `http://spine.local:7746` works only once it's in each computer's hosts file ([how](../https-and-domains/#a-name-instead-of-an-ip)).

### Port 7746 already in use

If another program already has the port, the start stops with "port is already allocated" or "address already in use". See what has it with `sudo lsof -nP -iTCP:7746 -sTCP:LISTEN`, and give Spine another port:

```bash
./install.sh --port 8080
```

Spine then opens at `http://localhost:8080`, and the port goes in the address for links. A port in the address does the same (`--app-url http://192.168.1.20:8080`). To change the port of an install, change `SPINE_PORT` in `.env`, and the port in `APP_URL` and `API_URL`, then run `docker compose --profile minimal up -d`.

The installer:

1. checks Docker and Compose;
2. writes `.env` with the address, the port, a random `AUTH_SECRET` and database password (an existing `.env` is never changed);
3. downloads Spine's images and starts it, waiting until it's healthy;
4. prints the address, the other addresses it opens at, and the commands for logs, backups, upgrades and stopping.

The first start takes a minute or two while the images download and the database is set up.

### Your settings: `.env`

`.env` is Spine's settings file, in the folder you installed in. Its name starts with a dot, so `ls` hides it: `ls -a` shows it, and `grep -E '^(APP_URL|SPINE_PORT)' .env` shows the address and the port. Docker Compose reads it every time Spine starts.

Running `./install.sh` again keeps `.env` as it is ("Keeping your existing .env"), and `--app-url`, `--port` and `--behind-proxy` are left unused. To change the address for links, change `APP_URL` and `API_URL` together in `.env`, then run `docker compose --profile minimal up -d`. Links already sent keep the old address. [Configuration](../configuration/) lists every setting.

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
| `caddy` | Serves both on Spine's port, and gets the HTTPS certificate for a domain. It runs `spine-proxy`: Caddy with Spine's routing built in |

Stop Spine with `docker compose --profile minimal down` and start it again with `./install.sh` (it keeps your `.env`).

:::caution[Never add -v]
`docker compose down -v` deletes the database and every stored file. Use `docker compose down` to stop Spine.
:::

## Next

- [Configuration](../configuration/): every setting in `.env`.
- [Email](../email/): send quotes, invoices and invitations.
- [Backups and restore](../backups/): set this up before you rely on Spine.
- [HTTPS and domains](../https-and-domains/).
- [Docker panels](../docker-panels/): Portainer, Dockge, Synology, TrueNAS, Dokploy, Easypanel and Runtipi.
