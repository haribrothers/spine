---
title: HTTPS and domains
description: Open Spine on your network over plain HTTP, or on HTTPS with a domain, Tailscale, a tunnel or your own proxy.
sidebar:
  order: 7
---

Spine's Caddy container serves the web app and the API together on one port, **7746**, at any address. On your network that's plain HTTP. For HTTPS, which the field app and browser notifications need, give Spine a domain, or put something in front that handles HTTPS: Tailscale, a Cloudflare Tunnel or your own proxy.

## On your network

Out of the box, Spine opens at:

- `http://localhost:7746` on the machine running it;
- `http://<its IP address>:7746`, for example `http://192.168.1.20:7746`, from every other device on the network.

Sign-in works at each of these, and nothing redirects to HTTPS. `APP_URL` in `.env` is only the address Spine writes into links, so set it to one everyone can open, such as the IP. Reserve that IP for the machine in your router, so it doesn't change.

Another port: `SPINE_PORT` in `.env` (`./install.sh --port 8080` on a new install), with the same port in `APP_URL` and `API_URL`. `SPINE_PORT=127.0.0.1:7746` keeps Spine to the machine itself.

Over plain HTTP, passwords and sign-in cookies cross the network unencrypted. That's fine on a network you trust, such as your office's. Use HTTPS on Wi-Fi you don't control, and for anything reachable from the internet.

### A name instead of an IP

A name of your own, like `http://spine.local:7746`, survives the IP changing, but opens only once each computer knows where it is. Spine doesn't announce it on the network, so add it to the hosts file of each computer that opens Spine (`127.0.0.1` on the machine running Spine, its network address on the others):

```bash
echo "192.168.1.20 spine.local" | sudo tee -a /etc/hosts
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder   # macOS only
```

On Windows the file is `C:\Windows\System32\drivers\etc\hosts`. Phones don't have one, so on a phone use the IP.

## Your own domain

1. Create a DNS `A` record (and `AAAA` for IPv6) for your domain, e.g. `spine.example.com`, pointing at the machine.
2. Open ports **80** and **443** to it. Caddy needs port 80 to get the certificate.
3. Install with the domain:

   ```bash
   ./install.sh --app-url https://spine.example.com
   ```

The installer sets `SITE_ADDRESS=spine.example.com, :7746` in `.env`, so Caddy gets the domain's certificate, and writes `docker-compose.override.yml` to publish ports 80 and 443. Port 7746 is kept to the machine itself (`SPINE_PORT=127.0.0.1:7746`): everyone else uses the domain. Caddy requests the certificate on the first visit and renews it on its own. Every page is then served over HTTPS with HSTS.

A domain can't use another port: Let's Encrypt checks it on ports 80 and 443. If something else holds them, use one of the next two options.

## HTTPS without a domain: Tailscale

[Tailscale](https://tailscale.com) connects your devices in a private network, the tailnet, and gives each machine a name with a trusted HTTPS certificate, such as `https://spine.tail1234.ts.net`. It works from anywhere you're signed in to Tailscale, phones and the field app included, and nothing is opened to the internet.

1. Install Tailscale on the machine running Spine and on each device that uses it. In the Tailscale admin console, turn on **MagicDNS** and **HTTPS certificates**.
2. Install Spine with the machine's Tailscale name:

   ```bash
   ./install.sh --app-url https://spine.tail1234.ts.net --behind-proxy
   ```

3. Have Tailscale serve Spine's port over HTTPS:

   ```bash
   sudo tailscale serve --bg 7746
   ```

Open `https://spine.tail1234.ts.net`. Spine still opens at `http://<its IP>:7746` on your local network.

## Behind another proxy or a tunnel

When a proxy in front already handles HTTPS (Nginx Proxy Manager, Traefik, Caddy, a NAS's reverse proxy, a load balancer), point it at Spine's port, `http://<this machine>:7746`, and install with its address:

```bash
./install.sh --app-url https://spine.example.com --behind-proxy
```

`--behind-proxy` sets `TRUSTED_PROXIES=private_ranges`, so Caddy believes the front proxy's `X-Forwarded-For` and Spine sees each visitor's own address (its rate limits count per visitor). On a machine that runs several apps, this is the usual set-up: one proxy holds ports 80 and 443 and sends each domain to its app's port. On Coolify, the Compose file does this for you: see [Running on Coolify](../coolify/).

**Cloudflare Tunnel:** `--profile full` adds a Cloudflare Tunnel without opening any port. Set `CLOUDFLARE_TUNNEL_TOKEN` in `.env` from your Cloudflare dashboard, point the tunnel's public hostname at `http://caddy:7746`, and install with `--app-url https://<that hostname> --behind-proxy --profile full`.

## Changing how Spine is reached

All of this lives in `.env` (and, for a domain, `docker-compose.override.yml`). Change it, then run `docker compose --profile minimal up -d`:

| Setting | What it does |
|---|---|
| `APP_URL`, `API_URL` | The address in links, and `<that address>/api` |
| `SPINE_PORT` | The port Spine opens on at any address (`7746`), or `127.0.0.1:7746` for this machine only |
| `SITE_ADDRESS` | What Caddy serves: `:7746` by default; `spine.example.com, :7746` to get the domain's certificate (with ports 80 and 443 published in `docker-compose.override.yml`) |
| `TRUSTED_PROXIES` | The proxies Caddy believes about visitors' addresses: `private_ranges` behind a proxy |

Links in emails you've already sent keep the address they were sent with.

### Your own routing

Spine's routing (`/api` to the API, everything else to the web app) is built into the `spine-proxy` image that the `caddy` service runs, so you don't need a Caddyfile. To change it, copy the release's `Caddyfile` to a file of your own, such as `Caddyfile.custom` (`upgrade.sh` replaces `Caddyfile` itself), edit it, and mount it in `docker-compose.override.yml`:

```yaml
services:
  caddy:
    volumes:
      - ./Caddyfile.custom:/etc/caddy/Caddyfile
```

If the file already publishes ports 80 and 443 for a domain, add `volumes:` under the same `caddy:`. Then run `docker compose --profile minimal up -d`. After an upgrade, compare yours with the new release's `Caddyfile`.
