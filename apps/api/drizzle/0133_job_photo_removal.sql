-- US-JOB-39 (D-277): a removed job photo keeps who removed it, when and why; its file link empties when the file is deleted, as attachments do.
ALTER TABLE "job_photos" DROP CONSTRAINT "job_photos_file_id_files_id_fk";
--> statement-breakpoint
ALTER TABLE "job_photos" ALTER COLUMN "file_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "job_photos" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_photos" ADD COLUMN "removed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "job_photos" ADD COLUMN "removal_reason" text;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_removed_by_user_id_user_id_fk" FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;