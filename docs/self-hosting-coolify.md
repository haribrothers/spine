# Running Spine on Coolify

How to run Spine, the beta included, on a server managed by [Coolify](https://coolify.io) (US-OPS-52). The plain-Docker route in [beta.md](beta.md) uses `install.sh`. On Coolify, Coolify does that job.

**How it fits:** Coolify's proxy already holds ports 80 and 443 and gets the HTTPS certificate. Spine's own Caddy runs behind it on port 80, with no published ports, and still does Spine's routing: `/api/auth/*` and the rest of `/api/*` to the API, and everything else to the web app. The Compose file for this is [`docker/coolify/docker-compose.yml`](../docker/coolify/docker-compose.yml), and each release also attaches it as `docker-compose.coolify.yml`.

Coolify's screens change between versions. If a name below doesn't match yours, the idea is the same: a Docker Compose resource, a domain on the `caddy` service, and its environment variables.

## Before you start

- A Coolify server (v4) whose proxy is running, and a DNS `A` record for `beta.h4loom.com` pointing at it.
- Spine's images are public, so the server needs no GitHub login to pull them. They're amd64 and arm64 from `1.0.0-beta.3`; earlier betas are amd64 only.

## Deploy

1. In Coolify, open a project and add a resource: **Docker Compose Empty**. Paste the contents of `docker-compose.coolify.yml`, from the release you're installing, then save.
2. **The domain:** on the `caddy` service, set the domain to `https://beta.h4loom.com`. Coolify routes it to Caddy's port 80, because the service declares `SERVICE_URL_CADDY_80`. Leave the other services without a domain.
3. **Environment variables:** Coolify lists every setting in the file.
   - `SERVICE_PASSWORD_64_AUTH` (the `AUTH_SECRET`) and `SERVICE_PASSWORD_POSTGRES` are generated once and kept. **Copy `SERVICE_PASSWORD_64_AUTH` somewhere safe:** a restore needs the same one.
   - Fill in the email service (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) and `BACKUP_PASSPHRASE`.
   - For backups off the server, fill in `BACKUP_REMOTE` and its keys (see Backups below).
   - Leave `SPINE_VERSION` empty to run the file's own version.
4. **Deploy.** The API applies its database migrations on the first start, then Coolify shows every service as healthy.
5. Open `https://beta.h4loom.com` and create your account: you're the Owner, and Spine is invite-only from then on. The rest is as in [beta.md](beta.md): invite testers, then send them the phone apps.

## Behind Cloudflare Access

If you put the domain behind Cloudflare Access (Zero Trust), for an extra sign-in before Spine's own, let Spine's own paths through. Otherwise the phone app, AI agents and customers' quote links get Access's sign-in page, which they can't use.

1. Add another self-hosted Access application for the same hostname, with these paths:
   - `api/*`: the API, which checks a Spine session on every request;
   - `.well-known/*`: how AI agents find out how to sign in;
   - `quote/*`: customers' quote links.
2. Give it a policy with action **Bypass**, including **Everyone**.

Cloudflare applies the more specific paths first, so everything else stays behind Access. To check from outside: `curl https://<address>/api/health` answers with Spine's version, while the web pages still go to Access's sign-in.

## Backups

On Coolify, backups go straight to an S3-compatible bucket (Cloudflare R2, Backblaze B2 or AWS S3), encrypted. Nothing is kept on the server, which Coolify can rebuild.

1. Make a bucket and a key that can read and write it. In the environment variables, set:

   ```sh
   BACKUP_REMOTE=s3://<bucket>/spine-beta
   BACKUP_REMOTE_ENDPOINT=https://<account>.r2.cloudflarestorage.com   # not needed for AWS
   BACKUP_REMOTE_ACCESS_KEY=…
   BACKUP_REMOTE_SECRET_KEY=…
   BACKUP_PASSPHRASE=…   # keep it somewhere other than the server
   ```

   Redeploy so the API has them.
2. Add a **Scheduled Task** to the resource:
   - **command:** `node apps/api/dist/scripts/backup.js --remote-only`
   - **container:** `api`
   - **frequency:** `0 2 * * *` (02:00 every night)

   Each run backs up the database and every file, encrypts the archive, uploads it, and keeps 7 daily and 4 weekly copies in the bucket.
3. Run the task once by hand and check its log ends with "Backup saved: s3://…". The Owners' "last backup" banner clears.

## Upgrading to a new beta

1. Run the backup task once by hand.
2. Paste the new release's `docker-compose.coolify.yml` over the old one, or just set `SPINE_VERSION` to the new version (e.g. `1.0.0-beta.2`).
3. Redeploy. If the new version brings migrations, the API takes a database snapshot first (in the `spine_snapshots` volume), then applies them; a failed migration changes nothing.

Settings › About Spine shows the new version.

## Restoring

To restore a backup into a fresh Coolify deployment, or onto a plain server:

1. Deploy a fresh resource as above, with the old deployment's `AUTH_SECRET`. Set `SERVICE_PASSWORD_64_AUTH` to the old value before the first deploy.
2. Download the backup from the bucket to the server.
3. On the server, find the resource's folder: `docker compose ls` lists each project with its config file. In that folder (it holds the resource's `docker-compose.yml` and `.env`), put `restore.sh` from the release and run:

   ```sh
   BACKUP_PASSPHRASE=… ./restore.sh /path/to/spine-backup-<date>.tar.gz.enc
   ```

   It stops the API and web app, checks everything, puts the database and files back, and starts them again.

## Other platforms

The same approach works on any platform whose proxy handles HTTPS in front of a Compose stack, such as Dokploy, CapRover or Portainer behind Traefik or nginx:

- Use the main `docker-compose.yml`. Remove the `caddy` service's `ports:`, and set `SITE_ADDRESS=:80` and `TRUSTED_PROXIES=private_ranges`.
- Point the platform's domain at the `caddy` service, port 80.
- Set `APP_URL` to the public address, and `API_URL` to it plus `/api`.
