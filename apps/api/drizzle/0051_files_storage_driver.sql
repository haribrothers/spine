-- US-OPS-27 (D-102): each file records the driver that stored it.
-- Generated as a plain ADD COLUMN ... DEFAULT 'local', then hand-edited:
-- every file stored before this migration lives in S3/MinIO (the only
-- driver until now), so existing rows are backfilled to 's3' before the
-- default switches new rows to 'local'.
ALTER TABLE "files" ADD COLUMN "storage_driver" text DEFAULT 's3' NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "storage_driver" SET DEFAULT 'local';
