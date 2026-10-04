ALTER TABLE "catalog_items" ALTER COLUMN "default_tax_rate_percentage" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "quote_lines" ALTER COLUMN "quantity" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "quote_lines" ALTER COLUMN "discount_percentage" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "quote_lines" ALTER COLUMN "tax_rate_percentage" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "retention_pct" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "milestones" ALTER COLUMN "amount" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "invoice_lines" ALTER COLUMN "quantity" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "invoice_lines" ALTER COLUMN "discount_percentage" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "invoice_lines" ALTER COLUMN "tax_rate_percentage" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "credit_note_lines" ALTER COLUMN "quantity" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "credit_note_lines" ALTER COLUMN "tax_rate_percentage" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "tax_rates" ALTER COLUMN "rate" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ALTER COLUMN "quantity" SET DATA TYPE numeric(18, 4);--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ALTER COLUMN "tax_rate_percentage" SET DATA TYPE numeric(18, 4);