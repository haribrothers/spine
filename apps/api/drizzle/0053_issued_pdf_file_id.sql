ALTER TABLE "quotes" ADD COLUMN "issued_pdf_file_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "issued_pdf_file_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "issued_pdf_file_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "issued_pdf_file_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_issued_pdf_file_id_files_id_fk" FOREIGN KEY ("issued_pdf_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_pdf_file_id_files_id_fk" FOREIGN KEY ("issued_pdf_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_issued_pdf_file_id_files_id_fk" FOREIGN KEY ("issued_pdf_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_issued_pdf_file_id_files_id_fk" FOREIGN KEY ("issued_pdf_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Hand-added: keep the PDFs already stored at send time (US-INV-17).
UPDATE "quotes" SET "issued_pdf_file_id" = "pdf_file_id" WHERE "pdf_file_id" IS NOT NULL;--> statement-breakpoint
UPDATE "invoices" SET "issued_pdf_file_id" = "pdf_file_id" WHERE "pdf_file_id" IS NOT NULL;
