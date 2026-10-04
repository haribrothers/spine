ALTER TABLE "quotes" DROP CONSTRAINT "quotes_pdf_file_id_files_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_pdf_file_id_files_id_fk";
--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "pdf_file_id";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "pdf_file_id";