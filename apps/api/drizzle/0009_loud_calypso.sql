ALTER TABLE "contacts" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "contacts_org_demo_idx" ON "contacts" USING btree ("org_id","is_demo");--> statement-breakpoint
CREATE INDEX "catalog_items_org_demo_idx" ON "catalog_items" USING btree ("org_id","is_demo");