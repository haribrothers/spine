CREATE TYPE "public"."invoice_reminder_kind" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TABLE "invoice_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"invoice_id" uuid NOT NULL,
	"sent_on" date NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "invoice_reminder_kind" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "reminders_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_reminders_invoice_day_uidx" ON "invoice_reminders" USING btree ("invoice_id","sent_on");--> statement-breakpoint
CREATE INDEX "invoice_reminders_org_idx" ON "invoice_reminders" USING btree ("org_id");