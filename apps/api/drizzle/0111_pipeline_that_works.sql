ALTER TABLE "leads" ADD COLUMN "stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- US-CRM-25: existing leads count their days in stage from their last change.
UPDATE "leads" SET "stage_changed_at" = "updated_at";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "expected_close_date" date;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lost_note" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quotes_org_lead_idx" ON "quotes" USING btree ("org_id","lead_id");