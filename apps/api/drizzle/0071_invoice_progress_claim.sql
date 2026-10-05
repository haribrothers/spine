ALTER TABLE "invoices" ADD COLUMN "progress_claim_no" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_job_progress_claim_uidx" ON "invoices" USING btree ("job_id","progress_claim_no");