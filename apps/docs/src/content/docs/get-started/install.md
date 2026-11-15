---
title: Install in 5 minutes
description: The short version of installing Spine with Docker.
sidebar:
  order: 2
---

On a Linux or macOS machine (or Windows with WSL2) with Docker 24+ and Compose 2.20+, download the newest release's files from the [releases page](https://github.com/haribrothers/spine/releases) into one folder: `install.sh`, `backup.sh`, `restore.sh`, `upgrade.sh`, `docker-compose.yml`, `Caddyfile` and `env.example`. Or, in a terminal, with the newest release's tag:

```bash
mkdir -p /opt/spine && cd /opt/spine
v=v1.0.0-beta.3
for f in install.sh backup.sh restore.sh upgrade.sh docker-compose.yml Caddyfile env.example; do
  curl -fsSLO "https://github.com/haribrothers/spine/releases/download/$v/$f"
done
chmod +x *.sh
./install.sh --app-url https://spine.example.com
```

On your own computer, use `--app-url http://localhost` instead: plain HTTP, fine for trying Spine out ([more](../../self-hosting/install/#2-run-the-installer)).

Open the address it prints and create your account: the first person to sign up owns the business. Then [issue your first invoice](../first-steps/#issue-your-first-invoice).

The [self-hosting guide](../../self-hosting/install/) explains every step, [the settings](../../self-hosting/configuration/), [email](../../self-hosting/email/), [backups](../../self-hosting/backups/) and [HTTPS on your domain](../../self-hosting/https-and-domains/).
