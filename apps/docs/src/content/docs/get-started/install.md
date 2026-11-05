---
title: Install in 5 minutes
description: The short version of installing Spine with Docker.
sidebar:
  order: 2
---

On a Linux or macOS machine (or Windows with WSL2) with Docker 24+ and Compose 2.20+:

```bash
mkdir -p /opt/spine && cd /opt/spine
gh release download --repo haribrothers/spine && chmod +x *.sh
./install.sh --app-url https://spine.example.com
```

Open the address it prints and create your account: the first person to sign up owns the business. Then [issue your first invoice](../first-steps/#issue-your-first-invoice).

The [self-hosting guide](../../self-hosting/install/) explains every step, [the settings](../../self-hosting/configuration/), [email](../../self-hosting/email/), [backups](../../self-hosting/backups/) and [HTTPS on your domain](../../self-hosting/https-and-domains/).
