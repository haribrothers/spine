-- US-OPS-39 (D-238): each person's recent records and searches.
ALTER TABLE "user" ADD COLUMN "recent_items" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "recent_searches" jsonb;--> statement-breakpoint
-- US-OPS-43, US-OPS-44: trigram indexes for the new search groups and contact people.
CREATE INDEX IF NOT EXISTS "leads_title_trgm_idx" ON "leads" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_title_trgm_idx" ON "meetings" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalog_items_name_trgm_idx" ON "catalog_items" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_credits_number_trgm_idx" ON "vendor_credits" USING gin ("number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_persons_name_trgm_idx" ON "contact_persons" USING gin ("name" gin_trgm_ops);
