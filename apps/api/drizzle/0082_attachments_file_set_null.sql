ALTER TABLE "attachments" DROP CONSTRAINT "attachments_file_id_files_id_fk";
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "file_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;