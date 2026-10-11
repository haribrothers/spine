ALTER TABLE "credit_note_lines" ADD COLUMN "invoice_line_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD COLUMN "tax_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD COLUMN "tax_group_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_invoice_line_id_invoice_lines_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "public"."invoice_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_tax_group_id_tax_groups_id_fk" FOREIGN KEY ("tax_group_id") REFERENCES "public"."tax_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_note_lines_invoice_line_idx" ON "credit_note_lines" USING btree ("invoice_line_id");