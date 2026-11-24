ALTER TABLE "catalog_bundle_lines" ADD COLUMN "hsn_sac" text;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "hsn_sac" text;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN "hsn_sac" text;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "hsn_sac" text;--> statement-breakpoint
ALTER TABLE "recurring_invoice_lines" ADD COLUMN "hsn_sac" text;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD COLUMN "hsn_sac" text;--> statement-breakpoint
ALTER TABLE "recurring_bill_lines" ADD COLUMN "hsn_sac" text;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD COLUMN "hsn_sac" text;--> statement-breakpoint
ALTER TABLE "vendor_credit_lines" ADD COLUMN "hsn_sac" text;