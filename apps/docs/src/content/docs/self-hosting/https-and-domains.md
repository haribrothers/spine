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

With `APP_URL=http://localhost` or the machine's address (`http://192.168.1.20`), Caddy serves plain HTTP. The field app and browser notifications need HTTPS, so use a real domain for anything beyond trying Spine out.

A name of your own, like `http://spine.local`, opens only once the computer knows where it is. Spine doesn't announce it on the network, so add it to the hosts file of each computer that opens Spine (`127.0.0.1` on the machine running Spine, its network address on the others):

```bash
echo "127.0.0.1 spine.local" | sudo tee -a /etc/hosts
echo "::1 spine.local" | sudo tee -a /etc/hosts
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder   # macOS only
```

On Windows the file is `C:\Windows\System32\drivers\etc\hosts`.

## HTTPS on your own computer

With `APP_URL=https://localhost` (or a `.local` name in the hosts file), Caddy can't get a certificate from Let's Encrypt, so it makes its own from a private authority it creates. Browsers warn about it until you trust that authority. On a Mac, from the folder you installed in:

```bash
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain caddy-root.crt
```

On Linux, copy `caddy-root.crt` to `/usr/local/share/ca-certificates/` and run `sudo update-ca-certificates`; Firefox keeps its own list (**Settings › Privacy & Security › Certificates › Import**). Phones don't trust it unless you install it on each one, so for the field app use a real domain. Spine tells browsers to use only HTTPS for its address (HSTS), so once you've opened `https://localhost`, the browser opens `localhost` over HTTPS for other projects too.

Not on an IP address: with `APP_URL=https://192.168.1.20`, browsers stop with `ERR_SSL_PROTOCOL_ERROR` ("sent an invalid response"), and `http://192.168.1.20` redirects there too. A browser sends no name when it opens an IP address over HTTPS, and inside Docker Caddy can't tell which certificate to use. For an IP address, use `http://`. For HTTPS on your network, use a name in each computer's hosts file instead.

## Another port

When ports 80 and 443 are in use, `./install.sh --port 8080` puts Spine on that port: the port goes in the address (`http://localhost:8080`, or `https://localhost:8443`), and `docker-compose.override.yml` publishes it instead of 80 and 443 ([Install](../install/#port-80-already-in-use)). To change the port of an install, change it in `APP_URL`, `API_URL` and `docker-compose.override.yml` together:

```yaml
services:
  caddy:
    ports: !override
      - "8080:8080"
```

Then run `docker compose --profile minimal up -d`. Without `!override`, Docker adds the port and still takes 80 and 443. A domain on another port can't get a Let's Encrypt certificate, which needs ports 80 and 443; put Spine behind the proxy that holds them ([Behind another proxy](#behind-another-proxy)), or use a Cloudflare Tunnel.
