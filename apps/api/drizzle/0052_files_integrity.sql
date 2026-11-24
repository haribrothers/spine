ALTER TABLE "files" ADD COLUMN "checksum_sha256" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "integrity_problem" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "integrity_checked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "files_integrity_problem_idx" ON "files" USING btree ("org_id","integrity_problem");