---
title: HTTPS and domains
description: Serve Spine on your own domain with automatic HTTPS, directly or behind another proxy.
sidebar:
  order: 7
---

Spine's Caddy container serves the web app and the API on one address and gets a free HTTPS certificate from Let's Encrypt by itself.

## Your own domain

1. Create a DNS `A` record (and `AAAA` for IPv6) for your domain, e.g. `spine.example.com`, pointing at the machine.
2. Open ports **80** and **443** to it (Caddy needs port 80 to get the certificate).
3. Set the address in `.env` and restart:

   ```bash
   APP_URL=https://spine.example.com
   API_URL=https://spine.example.com/api
   ```

Caddy requests the certificate on the first visit and renews it on its own. Every page is then served over HTTPS with HSTS.

## Behind another proxy

When another proxy in front already handles HTTPS — Coolify, Traefik, nginx, a load balancer — let it, and have Caddy listen on plain HTTP:

```bash
SITE_ADDRESS=:80
TRUSTED_PROXIES=private_ranges
```

Point the front proxy at Caddy's port 80. `TRUSTED_PROXIES` makes Caddy believe the front proxy's `X-Forwarded-For`, so Spine sees each visitor's own address (its rate limits count per visitor). On Coolify, the Compose file does this for you: see [Running on Coolify](../coolify/).

## Without opening ports

`--profile full` adds a Cloudflare Tunnel: set `CLOUDFLARE_TUNNEL_TOKEN` in `.env` from your Cloudflare dashboard, point the tunnel's public hostname at `http://caddy:80`, and set `SITE_ADDRESS=:80`.

## Only on your network

With `APP_URL=http://spine.local` (or the machine's address), Caddy serves plain HTTP. The field app and browser notifications need HTTPS, so use a real domain for anything beyond trying Spine out.
