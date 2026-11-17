---
title: Docker panels
description: Run Spine from Portainer, Dockge, Synology Container Manager, TrueNAS, Dokploy, Easypanel or Runtipi.
sidebar:
  order: 9
---

If you run your containers from a panel rather than a terminal, paste Spine's panel Compose file into it. Every release attaches it as **`docker-compose.panels.yml`** (in the repo: [`docker/panels/docker-compose.yml`](https://github.com/haribrothers/spine/blob/main/docker/panels/docker-compose.yml)). Nothing else goes beside it: there's no `.env` file to upload, no Caddyfile, and no profile to choose.

It runs the same four containers as [`install.sh`](../install/): the database, the API, the web app and Spine's proxy. Spine opens on port **7746** at any address, for example `http://192.168.1.20:7746`. For [Coolify](../coolify/), use its own file; [Runtipi](#runtipi) installs Spine from its own app store instead.

The Portainer steps were checked on Portainer 2.45, and Runtipi's app in a copy of how Runtipi runs apps; the others follow each panel's own documentation. Panels change their screens between versions, so if a name below doesn't match yours, look for the same idea: a Compose project or stack, its environment variables, and for Dokploy and Easypanel, a domain.

## The settings

Three settings are required. Without them the panel stops before starting anything, and says which one is missing.

| Setting | What to put |
|---|---|
| `AUTH_SECRET` | A random string of at least 32 characters. **Keep a copy somewhere safe:** a restore needs the same one. |
| `POSTGRES_PASSWORD` | The database password, letters and digits only (it goes inside an address). |
| `APP_URL` | The address for links in emails, PDFs and invitations: `http://<the machine's IP>:7746` on your network, or `https://spine.example.com` with a domain. |

`openssl rand -hex 32` makes a good value for each of the first two; so does a password manager's generator set to letters and digits.

The others are optional. The ones you're most likely to need:

| Setting | Default | What it does |
|---|---|---|
| `SPINE_PORT` | `7746` | The port Spine opens on. Change `APP_URL` to match. |
| `SPINE_VERSION` | the file's own | The version to run. Set it to upgrade. |
| `TRUSTED_PROXIES` | `127.0.0.1/32` | `private_ranges` when the panel's proxy is in front (Dokploy, Easypanel). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | none | The email service, for sending quotes, invoices and invitations ([Email](../email/)). |
| `BACKUP_PASSPHRASE`, `BACKUP_REMOTE` and its keys | none | Encrypted backups to a bucket (below). |

[Configuration](../configuration/) lists every setting; the file offers all of them.

## Portainer

1. **Stacks › Add stack.** Name it `spine` and choose **Web editor**.
2. Paste `docker-compose.panels.yml`.
3. Under **Environment variables**, add `AUTH_SECRET`, `POSTGRES_PASSWORD` and `APP_URL` (**Advanced mode** takes them pasted as `NAME=value` lines), and any others you need.
4. **Deploy the stack.** The first start takes a minute or two while the images download and the API sets up the database.

Open `http://<the machine's IP>:7746` and create your account.

**To upgrade:** open the stack, go to **Editor**, set `SPINE_VERSION` to the new version (or paste the new release's file), turn on **Re-pull image**, and **Update the stack**.

## Dockge

1. **+ Compose**, and name the stack `spine`.
2. Paste `docker-compose.panels.yml` into the compose editor.
3. In the **.env** box beside it, add `AUTH_SECRET=…`, `POSTGRES_PASSWORD=…` and `APP_URL=…`, one per line, and any others you need.
4. **Deploy.**

Open `http://<the machine's IP>:7746`.

**To upgrade:** **Edit**, set `SPINE_VERSION` in the `.env` box (or paste the new release's file), then **Update**.

## Synology Container Manager

1. In **File Station**, make a folder for Spine, for example `docker/spine`.
2. In **Container Manager › Project › Create**, name it `spine`, choose that folder as the path, and choose **Create docker-compose.yml** as the source.
3. Paste `docker-compose.panels.yml`. Container Manager has no form for settings, so replace each placeholder with your value, everywhere it appears: `${AUTH_SECRET:?…}`, `${POSTGRES_PASSWORD:?…}` and `${POSTGRES_PASSWORD}`, and `${APP_URL:?…}` and `${APP_URL}`.
4. Skip the web portal step, then **Done**. Container Manager downloads the images and starts the project.

Open `http://<the NAS's IP>:7746`. DSM itself uses ports 5000 and 5001, so 7746 doesn't clash.

**To upgrade:** stop the project, **Edit** its YAML to change the version in the three `image:` lines, then **Build** it again.

## TrueNAS

On TrueNAS SCALE 24.10 or newer:

1. **Apps › Discover Apps**, then **⋮ › Install via YAML**.
2. Name it `spine` and paste `docker-compose.panels.yml`. TrueNAS doesn't fill in `${…}` settings, so replace each placeholder with your value, everywhere it appears: `${AUTH_SECRET:?…}`, `${POSTGRES_PASSWORD:?…}` and `${POSTGRES_PASSWORD}`, and `${APP_URL:?…}` and `${APP_URL}`.
3. **Save.** TrueNAS downloads the images and starts the app.

Open `http://<the NAS's IP>:7746`.

**To upgrade:** **Apps › spine › Edit**, change the version in the three `image:` lines, and **Save**.

## Dokploy

Dokploy's proxy gets the domain's certificate and sends the traffic to Spine's proxy, so Spine needs no port of its own.

1. In a project, **Create Service › Compose**, and paste `docker-compose.panels.yml` in its editor.
2. **Delete the two `ports:` lines** under the `caddy` service. The domain replaces them.
3. In **Environment**, add the settings, with `APP_URL=https://spine.example.com` and `TRUSTED_PROXIES=private_ranges`.
4. In the service's **Advanced** settings, turn on **Isolated Deployments**, so Dokploy puts every Spine container on one network.
5. In **Domains**, **Add Domain**: your domain, service `caddy`, container port `7746`, with HTTPS on.
6. **Deploy.**

**To upgrade:** set `SPINE_VERSION` in **Environment** (or paste the new release's file, deleting `ports:` again), then **Deploy**.

## Easypanel

Easypanel's proxy, like Dokploy's, gets the certificate and sends the traffic to Spine's proxy.

1. In a project, **New Service › Compose**, choose the inline source, and paste `docker-compose.panels.yml`.
2. **Delete the two `ports:` lines** under the `caddy` service. Easypanel warns about published ports, and the domain replaces them.
3. In **Environment**, add the settings, with `APP_URL=https://spine.example.com` and `TRUSTED_PROXIES=private_ranges`, and turn on **Create .env file**.
4. **Deploy.**
5. In **Domains**, add your domain: Compose service `caddy`, port `7746`.

**To upgrade:** set `SPINE_VERSION` in **Environment** (or paste the new release's file, deleting `ports:` again), then **Deploy**.

## Runtipi

Runtipi installs apps from app stores rather than a pasted file, so Spine has its own store: [github.com/haribrothers/spine-runtipi](https://github.com/haribrothers/spine-runtipi). It's the same four containers, with Runtipi generating the secret and the database password.

1. **Settings › App Stores › Add App Store**, and paste `https://github.com/haribrothers/spine-runtipi`.
2. Install **Spine** from the app store. **Address for links** is the address you'll open it at: with **expose locally** on, `https://spine.<your local domain>` (for example `https://spine.tipi.lan`); otherwise `http://<the server's IP>:7746`.
3. Open it and create your account.

Runtipi's local certificate is its own, so each device must trust it (download it from Runtipi's settings, under **Local domain**), and the field app can't use it: use Tailscale for the field app. With an `https://` address for links, sign in through that address, not over plain HTTP on the port. Runtipi's own backups include Spine's data. To move an install you already have into Runtipi, follow the store's README: it backs up the old install and restores the backup into Runtipi's Spine.

**To upgrade:** **Settings › Update App Stores**, then update Spine. The store follows Spine's releases.

## HTTPS and the field app

On your network Spine is plain HTTP, which is fine in an office you trust. The field app and browser notifications need HTTPS:

- **Dokploy and Easypanel** give Spine its domain's certificate.
- **Runtipi** with your own domain exposed gives it a real certificate; its local subdomain doesn't (above).
- **On a NAS or your own machine** (Portainer, Dockge, Synology, TrueNAS), use Tailscale: [HTTPS without a domain](../https-and-domains/#https-without-a-domain-tailscale). Set `APP_URL` to the Tailscale address and `TRUSTED_PROXIES=private_ranges`.

## Backups

Back up to an S3-compatible bucket (Cloudflare R2, Backblaze B2 or AWS S3), encrypted, so a copy lives off the machine.

1. Set `BACKUP_PASSPHRASE`, `BACKUP_REMOTE` and its keys, as on the [Coolify page](../coolify/#backups), and redeploy.
2. Run the backup every night in the `api` container:

   ```sh
   node apps/api/dist/scripts/backup.js --remote-only
   ```

   - **Dokploy:** add it under **Schedules** as a Compose job on the `api` service, `0 2 * * *`.
   - **Elsewhere:** add it to the machine's own scheduler (cron, Synology's Task Scheduler, TrueNAS's Cron Jobs), running it in the API container:

     ```sh
     docker exec $(docker ps -q -f label=com.docker.compose.project=spine -f label=com.docker.compose.service=api) node apps/api/dist/scripts/backup.js --remote-only
     ```

     `spine` is the name you gave the stack, project or app.

Run it once by hand: the log ends with "Backup saved: s3://…", and the Owners' backup banner clears.

## Restoring

`restore.sh` from the release works on a panel's install too, given the project's name and the same three settings:

1. Download the backup from the bucket to the machine.
2. Make a folder with `restore.sh` and the Compose file you deployed, saved as `docker-compose.yml` (with the `ports:` lines deleted if you deleted them in the panel).
3. In it, write a `.env` with the project's name and **every setting you gave the panel**, not just the three required ones. `restore.sh` restarts the API and web app with these, so a missing one would change them:

   ```sh
   COMPOSE_PROJECT_NAME=spine
   AUTH_SECRET=…
   POSTGRES_PASSWORD=…
   APP_URL=…
   # …and SPINE_VERSION, SPINE_PORT, SMTP_HOST and the rest, if you set them
   ```

   `spine` is the name you gave the stack, project or app. Docker Compose then reaches the panel's containers and volumes.
4. Run:

   ```sh
   BACKUP_PASSPHRASE=… ./restore.sh /path/to/spine-backup-<date>.tar.gz.enc
   ```

It stops the API and web app, checks everything, puts the database and files back, and starts them again. On a new machine, deploy Spine in the panel with the old `AUTH_SECRET` first.
