---
title: Troubleshooting
description: The health check, the logs, the email log, and the most common problems with what to do.
sidebar:
  order: 9
---

## Is it running?

```bash
docker compose ps
curl -s https://spine.example.com/api/health/ready
```

`/api/health/ready` answers `200` once the database and the job queue answer, with the storage status. `/api/health` answers as soon as the API is up.

## The logs

```bash
docker compose logs -f api        # the API: requests, migrations, emails, jobs
docker compose logs -f web caddy  # the web app and the front door
```

Every request is logged with an id. When Spine shows **Something went wrong on our side**, the page's **Error reference** is that id: search the API log for it. Passwords, tokens, cookies and card or bank numbers are never written to the logs.

## Emails

Owners open **Settings › Team › Email log** to see every email with its status and error; see [Email](../email/).

## Common problems

| What you see | What to do |
|---|---|
| `install.sh` says Docker or Compose is too old | Install Docker 24+ with Compose 2.20+ (`docker compose version`) |
| "port is already allocated" or "address already in use" when Spine starts | Another program has the port: `sudo lsof -nP -iTCP:7746 -sTCP:LISTEN` names it (80 or 443 with a domain). Change `SPINE_PORT` in `.env` (and the port in `APP_URL` and `API_URL`), or install with `--port 8080` ([Install](../install/#port-7746-already-in-use)) |
| Spine opens on this computer but not from another one | Use `http://<this computer's IP>:7746`, with the port. If it doesn't connect at all, the firewall on Spine's computer is blocking the port, or `SPINE_PORT` is `127.0.0.1:…` (this computer only) |
| `http://spine.local` (or another name of your own) doesn't open | Spine doesn't announce names on the network: add the name to the hosts file ([how](../https-and-domains/#a-name-instead-of-an-ip)), or use the IP |
| `ERR_SSL_PROTOCOL_ERROR` ("sent an invalid response") on `https://<IP address>`, and `http://` jumps to it | An older install with `APP_URL=https://<IP>`: HTTPS doesn't work on a bare IP. Set `APP_URL=http://<IP>:7746` and `API_URL=http://<IP>:7746/api`, remove `SITE_ADDRESS` and set `SPINE_PORT=7746` in `.env`, then `docker compose --profile minimal up -d`; open it in a private window (the browser remembers the old redirect). For HTTPS, use [Tailscale](../https-and-domains/#https-without-a-domain-tailscale) |
| `./install.sh --app-url …` ran, but the old address is still used | An existing `.env` is kept as it is. Change `APP_URL` and `API_URL` in `.env`, then `docker compose --profile minimal up -d` |
| Links in emails point at `localhost` | `APP_URL` is the address Spine writes into links. Set it to one the people you send them to can open (`http://<IP>:7746`, or your domain) |
| The address doesn't open, or the certificate fails | Check the DNS record points at this machine and ports 80 and 443 are open; `docker compose logs caddy` says why |
| "Spine won't start" in the API log after an upgrade | A migration failed and nothing changed. The log names the snapshot; go back to the previous `SPINE_VERSION` in `.env` and start, or restore the backup `upgrade.sh` made, then report the error |
| Emails stay queued | `SMTP_*` aren't set, or are wrong; the email log shows the error |
| Uploads fail | The disk is full (Owners see a banner above 85%), or the `s3` driver's settings are wrong |
| "This Spine is invite-only" on sign-up | Expected: only the first person can sign up. Ask an Owner for an invitation |
| Lost the only Owner's password | **Forgot password** on the login page sends a reset link (email must work) |
| The field app says "Update Spine to keep going" | The server's `MOBILE_MIN_VERSION` is newer than the app; update it from the store |
| A restore says the backup's secret doesn't match | Put the old install's `AUTH_SECRET` in `.env`, or add `--new-secret` |

## Still stuck?

[Open an issue](https://github.com/haribrothers/spine/issues/new/choose) with your version (Settings › About Spine), what you did, and the relevant log lines with anything private removed.
