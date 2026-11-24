---
title: File storage
description: Where Spine keeps attachments, photos, receipts, logos and issued PDFs.
sidebar:
  order: 4
---

Spine stores every attachment, site photo, receipt, logo and issued PDF through one storage driver, and only ever serves a file after checking that the person may see the record it belongs to.

## Local (the default)

`STORAGE_DRIVER=local` keeps files on the API container's `spine_files` Docker volume, at `/data/files`. No extra service is needed, and [backups](../backups/) include every file.

:::caution[Never add -v]
`docker compose down -v` deletes the `spine_files` volume along with the database. Use `docker compose down` to stop Spine.
:::

## An S3-compatible bucket

To keep files in AWS S3, Cloudflare R2, Backblaze B2 or a self-hosted store instead, set in `.env`:

```bash
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_BUCKET=spine
S3_ACCESS_KEY=…
S3_SECRET_KEY=…
S3_REGION=auto
```

Files stored before a switch stay readable while the old driver's settings are still present. Backups read the files from the bucket too.

### A self-hosted store

`docker compose --profile minimal --profile rustfs up -d` also runs RustFS, an S3-compatible store, on the same machine. Point Spine at it with `S3_ENDPOINT=http://rustfs:9000`.

## Moving files off MinIO

Older installs kept files in MinIO, which Spine no longer starts. Either:

- **Move them to local storage (recommended).** Keep MinIO running and your `S3_*` settings, start the new version, then run

  ```bash
  docker compose exec api pnpm --filter @spine/api files:migrate --from s3 --to local
  ```

  It copies every file into the `spine_files` volume, checks each copy against its checksum and prints how many were copied, skipped and failed. Nothing in the bucket changes. If any fail, fix the cause and run it again: files already moved are skipped. When it reports no failures, set `STORAGE_DRIVER=local` and restart.
- **Keep MinIO.** Set `STORAGE_DRIVER=s3`, keep your `S3_*` settings and run MinIO yourself.

## Running out of space

Owners see a banner when the files volume is more than 85% full. Free space on the machine or move to a bucket before it fills: uploads stop when the disk is full, and nothing else is affected.

Once a week Spine reads every stored file and checks it against its checksum; if a file is damaged or missing, Owners get a notification naming the records.
