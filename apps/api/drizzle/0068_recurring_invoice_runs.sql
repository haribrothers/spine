ALTER TABLE "invoices" ADD COLUMN "recurring_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "recurring_run_on" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurring_invoice_id_recurring_invoices_id_fk" FOREIGN KEY ("recurring_invoice_id") REFERENCES "public"."recurring_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_recurring_run_uidx" ON "invoices" USING btree ("recurring_invoice_id","recurring_run_on");