-- US-OPS-22 (D-095): global search uses Postgres trigram indexes, no external service.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_name_trgm_idx" ON "contacts" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_number_trgm_idx" ON "quotes" USING gin ("number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_number_trgm_idx" ON "invoices" USING gin ("number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_name_trgm_idx" ON "jobs" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_number_trgm_idx" ON "jobs" USING gin ("number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_bills_bill_number_trgm_idx" ON "vendor_bills" USING gin ("bill_number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_number_trgm_idx" ON "expenses" USING gin ("number" gin_trgm_ops);
