CREATE TYPE "public"."supply_class" AS ENUM('taxable', 'zero_rated', 'exempt', 'non_taxable');--> statement-breakpoint
ALTER TABLE "catalog_bundle_lines" ADD COLUMN "supply_class" "supply_class";--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "supply_class" "supply_class" DEFAULT 'taxable' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN "supply_class" "supply_class";--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "supply_class" "supply_class";--> statement-breakpoint
ALTER TABLE "recurring_invoice_lines" ADD COLUMN "supply_class" "supply_class";--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD COLUMN "supply_class" "supply_class";--> statement-breakpoint
ALTER TABLE "recurring_bill_lines" ADD COLUMN "supply_class" "supply_class";--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD COLUMN "supply_class" "supply_class";--> statement-breakpoint
ALTER TABLE "vendor_credit_lines" ADD COLUMN "supply_class" "supply_class";--> statement-breakpoint
-- US-TAX-11: existing item lines are taxable where they carry tax, else zero-rated; heading and text lines stay null.
UPDATE "catalog_items" SET "supply_class" = CASE WHEN "default_tax_rate_percentage" > 0 THEN 'taxable' ELSE 'zero_rated' END::"supply_class";--> statement-breakpoint
UPDATE "catalog_bundle_lines" SET "supply_class" = CASE WHEN "tax_rate_percentage" > 0 THEN 'taxable' ELSE 'zero_rated' END::"supply_class" WHERE "type" = 'item';--> statement-breakpoint
UPDATE "quote_lines" SET "supply_class" = CASE WHEN "tax_rate_percentage" > 0 THEN 'taxable' ELSE 'zero_rated' END::"supply_class" WHERE "type" = 'item';--> statement-breakpoint
UPDATE "invoice_lines" SET "supply_class" = CASE WHEN "tax_rate_percentage" > 0 THEN 'taxable' ELSE 'zero_rated' END::"supply_class" WHERE "type" = 'item';--> statement-breakpoint
UPDATE "recurring_invoice_lines" SET "supply_class" = CASE WHEN "tax_rate_percentage" > 0 THEN 'taxable' ELSE 'zero_rated' END::"supply_class" WHERE "type" = 'item';--> statement-breakpoint
UPDATE "credit_note_lines" SET "supply_class" = CASE WHEN "tax_rate_percentage" > 0 THEN 'taxable' ELSE 'zero_rated' END::"supply_class" WHERE "type" = 'item';--> statement-breakpoint
UPDATE "recurring_bill_lines" SET "supply_class" = CASE WHEN "tax_rate_percentage" > 0 THEN 'taxable' ELSE 'zero_rated' END::"supply_class" WHERE "type" = 'item';--> statement-breakpoint
UPDATE "vendor_bill_lines" SET "supply_class" = CASE WHEN "tax_rate_percentage" > 0 THEN 'taxable' ELSE 'zero_rated' END::"supply_class" WHERE "type" = 'item';--> statement-breakpoint
UPDATE "vendor_credit_lines" SET "supply_class" = CASE WHEN "tax_rate_percentage" > 0 THEN 'taxable' ELSE 'zero_rated' END::"supply_class" WHERE "type" = 'item';
