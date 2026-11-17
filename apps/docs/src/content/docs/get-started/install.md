---
title: Install in 5 minutes
description: The short version of installing Spine with Docker.
sidebar:
  order: 2
---

On a Linux or macOS machine (or Windows with WSL2) with Docker 24+ and Compose 2.20+, download the newest release's files from the [releases page](https://github.com/haribrothers/spine/releases) into one folder: `install.sh`, `backup.sh`, `restore.sh`, `upgrade.sh`, `docker-compose.yml` and `env.example`. Or, in a terminal, with the newest release's tag:

```bash
mkdir -p /opt/spine && cd /opt/spine
v=v1.0.0-beta.5
for f in install.sh backup.sh restore.sh upgrade.sh docker-compose.yml env.example; do
  curl -fsSLO "https://github.com/haribrothers/spine/releases/download/$v/$f"
done
chmod +x *.sh
./install.sh
```

Spine opens on port 7746 at any address: `http://localhost:7746` on that computer, `http://<its IP address>:7746` from the rest of your network. The installer asks for the address to put in links and suggests the computer's IP. Port 7746 taken? Add `--port 8080` ([more](../../self-hosting/install/#port-7746-already-in-use)). On a server with a domain, use `./install.sh --app-url https://spine.example.com` and Caddy gets the HTTPS certificate. The installer writes your settings to `.env` in that folder ([what's in it](../../self-hosting/install/#your-settings-env)).

Open the address it prints and create your account: the first person to sign up owns the business. Then [issue your first invoice](../first-steps/#issue-your-first-invoice).

The [self-hosting guide](../../self-hosting/install/) explains every step, [the settings](../../self-hosting/configuration/), [email](../../self-hosting/email/), [backups](../../self-hosting/backups/) and [HTTPS on your domain](../../self-hosting/https-and-domains/).
