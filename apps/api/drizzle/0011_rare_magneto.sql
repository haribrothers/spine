ALTER TABLE "quotes" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "quotes_org_demo_idx" ON "quotes" USING btree ("org_id","is_demo");