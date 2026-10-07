CREATE TYPE "public"."supply_type" AS ENUM('intra', 'inter', 'export');--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "inter_tax_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "inter_tax_group_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "place_of_supply" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "supply_type" "supply_type";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "place_of_supply" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "supply_type" "supply_type";--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "place_of_supply" text;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "supply_type" "supply_type";--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD COLUMN "place_of_supply" text;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD COLUMN "supply_type" "supply_type";--> statement-breakpoint
ALTER TABLE "vendor_credits" ADD COLUMN "place_of_supply" text;--> statement-breakpoint
ALTER TABLE "vendor_credits" ADD COLUMN "supply_type" "supply_type";--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_inter_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("inter_tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_inter_tax_group_id_tax_groups_id_fk" FOREIGN KEY ("inter_tax_group_id") REFERENCES "public"."tax_groups"("id") ON DELETE set null ON UPDATE no action;