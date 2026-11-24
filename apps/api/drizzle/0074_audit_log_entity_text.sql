ALTER TABLE "audit_log" ALTER COLUMN "entity_id" SET DATA TYPE text;--> statement-breakpoint
CREATE INDEX "audit_log_org_created_idx" ON "audit_log" USING btree ("org_id","created_at");