CREATE TYPE "public"."recurring_frequency" AS ENUM('weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."recurring_mode" AS ENUM('issue_and_email', 'draft');--> statement-breakpoint
CREATE TYPE "public"."recurring_status" AS ENUM('active', 'paused', 'finished');--> statement-breakpoint
CREATE TABLE "recurring_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_invoice_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"type" "invoice_line_type" DEFAULT 'item' NOT NULL,
	"catalog_item_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"quantity" numeric(18, 4) DEFAULT 0 NOT NULL,
	"unit_price_amount" bigint DEFAULT 0 NOT NULL,
	"discount_percentage" numeric(18, 4) DEFAULT 0 NOT NULL,
	"tax_rate_percentage" numeric(18, 4) DEFAULT 0 NOT NULL,
	"tax_rate_id" uuid,
	"tax_group_id" uuid,
	"is_tax_inclusive" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"frequency" "recurring_frequency" NOT NULL,
	"day_rule" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"max_count" integer,
	"created_count" integer DEFAULT 0 NOT NULL,
	"due_days" integer DEFAULT 14 NOT NULL,
	"mode" "recurring_mode" NOT NULL,
	"status" "recurring_status" DEFAULT 'active' NOT NULL,
	"next_run_on" date,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_invoice_lines" ADD CONSTRAINT "recurring_invoice_lines_recurring_invoice_id_recurring_invoices_id_fk" FOREIGN KEY ("recurring_invoice_id") REFERENCES "public"."recurring_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_lines" ADD CONSTRAINT "recurring_invoice_lines_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_lines" ADD CONSTRAINT "recurring_invoice_lines_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_lines" ADD CONSTRAINT "recurring_invoice_lines_tax_group_id_tax_groups_id_fk" FOREIGN KEY ("tax_group_id") REFERENCES "public"."tax_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_invoice_lines_schedule_idx" ON "recurring_invoice_lines" USING btree ("recurring_invoice_id","sort_order");--> statement-breakpoint
CREATE INDEX "recurring_invoices_org_idx" ON "recurring_invoices" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "recurring_invoices_next_run_idx" ON "recurring_invoices" USING btree ("status","next_run_on");--> statement-breakpoint
-- US-INV-20: new Team-configurable capability `invoices.manage_recurring`
-- (default granted for General Staff). Backfilled onto every Team with the
-- same grant as its `invoices.edit_own`, so Teams that already create
-- invoices can set up recurring ones. Safe to re-run.
INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, 'invoices.manage_recurring', tp.granted
FROM team_privileges tp
WHERE tp.capability = 'invoices.edit_own'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = 'invoices.manage_recurring'
	);
