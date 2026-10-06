CREATE TYPE "public"."recurring_bill_mode" AS ENUM('record', 'draft');--> statement-breakpoint
CREATE TABLE "recurring_bill_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_bill_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"type" "vendor_bill_line_type" DEFAULT 'item' NOT NULL,
	"catalog_item_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"quantity" numeric(18, 4) DEFAULT 0 NOT NULL,
	"unit_price_amount" bigint DEFAULT 0 NOT NULL,
	"account_id" uuid,
	"tax_rate_percentage" numeric(18, 4) DEFAULT 0 NOT NULL,
	"tax_rate_id" uuid,
	"tax_group_id" uuid,
	"is_tax_inclusive" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_bills" (
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
	"money_account_id" uuid,
	"mode" "recurring_bill_mode" NOT NULL,
	"status" "recurring_status" DEFAULT 'active' NOT NULL,
	"next_run_on" date,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD COLUMN "recurring_bill_id" uuid;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD COLUMN "recurring_run_on" date;--> statement-breakpoint
ALTER TABLE "recurring_bill_lines" ADD CONSTRAINT "recurring_bill_lines_recurring_bill_id_recurring_bills_id_fk" FOREIGN KEY ("recurring_bill_id") REFERENCES "public"."recurring_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill_lines" ADD CONSTRAINT "recurring_bill_lines_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill_lines" ADD CONSTRAINT "recurring_bill_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill_lines" ADD CONSTRAINT "recurring_bill_lines_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill_lines" ADD CONSTRAINT "recurring_bill_lines_tax_group_id_tax_groups_id_fk" FOREIGN KEY ("tax_group_id") REFERENCES "public"."tax_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_money_account_id_money_accounts_id_fk" FOREIGN KEY ("money_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_bill_lines_schedule_idx" ON "recurring_bill_lines" USING btree ("recurring_bill_id","sort_order");--> statement-breakpoint
CREATE INDEX "recurring_bills_org_idx" ON "recurring_bills" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "recurring_bills_next_run_idx" ON "recurring_bills" USING btree ("status","next_run_on");--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_recurring_bill_id_recurring_bills_id_fk" FOREIGN KEY ("recurring_bill_id") REFERENCES "public"."recurring_bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_bills_recurring_run_uidx" ON "vendor_bills" USING btree ("recurring_bill_id","recurring_run_on");--> statement-breakpoint
-- US-PUR-29: new Team-configurable capability `vendor_bills.manage_recurring`
-- (default granted for General Staff). Backfilled onto every Team with the
-- same grant as its `vendor_bills.edit_own`, so Teams that already enter
-- bills can set up recurring ones. Safe to re-run.
INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, 'vendor_bills.manage_recurring', tp.granted
FROM team_privileges tp
WHERE tp.capability = 'vendor_bills.edit_own'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = 'vendor_bills.manage_recurring'
	);
