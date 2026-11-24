ALTER TABLE "tax_rates" ADD COLUMN "supply_class" "supply_class";--> statement-breakpoint
-- D-182: 0% rates the country presets created say what they mean.
UPDATE "tax_rates" SET "supply_class" = 'exempt' WHERE "rate" = 0 AND lower("name") = 'exempt';--> statement-breakpoint
UPDATE "tax_rates" SET "supply_class" = 'zero_rated' WHERE "rate" = 0 AND "name" IN ('VAT 0%', 'GST 0%', 'GST-free') AND "tax_type" IN ('vat', 'gst');
