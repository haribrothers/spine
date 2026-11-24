CREATE TYPE "public"."tax_group_scope" AS ENUM('intra', 'inter', 'any');--> statement-breakpoint
CREATE TYPE "public"."tax_type" AS ENUM('cgst', 'sgst', 'utgst', 'igst', 'cess', 'vat', 'gst', 'sales_tax', 'other');--> statement-breakpoint
ALTER TABLE "tax_groups" ADD COLUMN "scope" "tax_group_scope" DEFAULT 'any' NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD COLUMN "tax_type" "tax_type" DEFAULT 'other' NOT NULL;