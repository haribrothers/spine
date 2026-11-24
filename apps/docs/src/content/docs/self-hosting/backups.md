---
title: Backups and restore
description: Save the database and every file into one archive, copy it off the machine, and restore it.
sidebar:
  order: 5
---

One command saves your database and every stored file into a single archive. Keep copies off the machine — a backup on the same disk won't survive that disk failing.

## Take a backup

```bash
./backup.sh --passphrase
# → backups/spine-backup-20261104-020000.tar.gz.enc
```

(From a clone of the repository: `./scripts/backup.sh --passphrase`.)

The archive holds the database, every stored file and a manifest with Spine's version and each file's checksum. With a passphrase it's encrypted with AES-256; without `--passphrase` (and no `BACKUP_PASSPHRASE`) it's a plain `.tar.gz`. `--output /mnt/usb` writes it to another folder.

:::danger[Keep the passphrase somewhere safe]
Without it, encrypted backups can't be restored. Spine never stores it. Keep it, and a copy of `AUTH_SECRET` from `.env`, somewhere other than this machine.
:::

## Back up every night

Set the passphrase in `.env` so the backup doesn't ask:

```bash
BACKUP_PASSPHRASE=a-long-phrase-you-keep-elsewhere
```

Then add the job with `crontab -e`:

```bash
0 2 * * * cd /opt/spine && ./backup.sh >> backups/backup.log 2>&1
```

Owners see a banner in Spine when the last backup is more than two days old.

## Copy backups off the machine automatically

Set these in `.env` and every backup is encrypted and uploaded, keeping 7 daily and 4 weekly copies:

| Variable | Example | Purpose |
|---|---|---|
| `BACKUP_PASSPHRASE` | (a long phrase) | Encrypts each archive |
| `BACKUP_REMOTE` | `s3://my-bucket/spine` | Where copies are uploaded |
| `BACKUP_REMOTE_ENDPOINT` | `https://<account>.r2.cloudflarestorage.com` | The bucket's address (R2, B2, S3) |
| `BACKUP_REMOTE_ACCESS_KEY` / `BACKUP_REMOTE_SECRET_KEY` | … | Credentials for that bucket |

Only encrypted archives are uploaded.

## Restore

```bash
./restore.sh backups/spine-backup-20261104-020000.tar.gz.enc
```

Spine stops while it restores and starts again with the backup's data. Everything is checked before anything changes. An encrypted backup asks for its passphrase (or reads `BACKUP_PASSPHRASE`). On an install that already has data, add `--replace` to delete it first. A backup from a newer version of Spine is refused: upgrade first.

### On a new machine

1. [Install Spine](../install/) with `./install.sh`.
2. Put the old install's `AUTH_SECRET` in the new `.env` (stored keys are encrypted with it), then restart.
3. Run `./restore.sh <archive>`.

If the old `AUTH_SECRET` is lost, `./restore.sh <archive> --new-secret` restores anyway: everyone signs in again, and connected AI keys and other stored secrets need entering again.

:::caution[Don't delete the volumes]
`docker compose down -v` deletes your database and files. Use `docker compose down` to stop Spine.
:::
