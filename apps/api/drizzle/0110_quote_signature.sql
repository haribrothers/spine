ALTER TABLE "quotes" ADD COLUMN "signature_file_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_signer_name" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_signature_file_id_files_id_fk" FOREIGN KEY ("signature_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;