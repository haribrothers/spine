CREATE TYPE "public"."vendor_credit_status" AS ENUM('draft', 'open', 'used', 'void');--> statement-breakpoint
CREATE TABLE "vendor_credit_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_credit_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"type" "vendor_bill_line_type" DEFAULT 'item' NOT NULL,
	"catalog_item_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"quantity" numeric(18, 4) DEFAULT 0 NOT NULL,
	"unit_price_amount" bigint DEFAULT 0 NOT NULL,
	"unit_price_currency" text NOT NULL,
	"account_id" uuid,
	"tax_rate_percentage" numeric(18, 4) DEFAULT 0 NOT NULL,
	"tax_rate_id" uuid,
	"tax_group_id" uuid,
	"is_tax_inclusive" boolean DEFAULT false NOT NULL,
	"line_subtotal_amount" bigint DEFAULT 0 NOT NULL,
	"line_tax_amount" bigint DEFAULT 0 NOT NULL,
	"line_total_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"number" text,
	"vendor_reference" text,
	"contact_id" uuid NOT NULL,
	"bill_id" uuid,
	"job_id" uuid,
	"date" date NOT NULL,
	"status" "vendor_credit_status" DEFAULT 'draft' NOT NULL,
	"currency" text NOT NULL,
	"subtotal_amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"balance_amount" bigint DEFAULT 0 NOT NULL,
	"is_opening" boolean DEFAULT false NOT NULL,
	"notes" text,
	"void_reason" text,
	"voided_at" timestamp with time zone,
	"recorded_at" timestamp with time zone,
	"entry_id" uuid,
	"void_entry_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_credits_balance_within_total" CHECK ("vendor_credits"."balance_amount" >= 0 AND "vendor_credits"."balance_amount" <= "vendor_credits"."total_amount")
);
--> statement-breakpoint
ALTER TABLE "vendor_credit_lines" ADD CONSTRAINT "vendor_credit_lines_vendor_credit_id_vendor_credits_id_fk" FOREIGN KEY ("vendor_credit_id") REFERENCES "public"."vendor_credits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit_lines" ADD CONSTRAINT "vendor_credit_lines_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit_lines" ADD CONSTRAINT "vendor_credit_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit_lines" ADD CONSTRAINT "vendor_credit_lines_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit_lines" ADD CONSTRAINT "vendor_credit_lines_tax_group_id_tax_groups_id_fk" FOREIGN KEY ("tax_group_id") REFERENCES "public"."tax_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credits" ADD CONSTRAINT "vendor_credits_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credits" ADD CONSTRAINT "vendor_credits_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credits" ADD CONSTRAINT "vendor_credits_bill_id_vendor_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."vendor_bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credits" ADD CONSTRAINT "vendor_credits_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credits" ADD CONSTRAINT "vendor_credits_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credits" ADD CONSTRAINT "vendor_credits_void_entry_id_journal_entries_id_fk" FOREIGN KEY ("void_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credits" ADD CONSTRAINT "vendor_credits_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_credit_lines_credit_idx" ON "vendor_credit_lines" USING btree ("vendor_credit_id");--> statement-breakpoint
CREATE INDEX "vendor_credits_org_status_idx" ON "vendor_credits" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "vendor_credits_contact_idx" ON "vendor_credits" USING btree ("contact_id");--> statement-breakpoint
-- US-PUR-28: vendor credit rights, backfilled from each Team's matching bill rights. Safe to re-run.
INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, map.credit_capability, tp.granted
FROM team_privileges tp
JOIN (VALUES
	('vendor_bills.edit_own', 'vendor_credits.edit_own'),
	('vendor_bills.edit_others', 'vendor_credits.edit_others'),
	('vendor_bills.delete_own', 'vendor_credits.delete_own'),
	('vendor_bills.delete_others', 'vendor_credits.delete_others'),
	('vendor_bills.record', 'vendor_credits.record'),
	('vendor_bills.record', 'vendor_credits.apply'),
	('vendor_bills.void', 'vendor_credits.void')
) AS map(bill_capability, credit_capability) ON map.bill_capability = tp.capability
WHERE NOT EXISTS (
	SELECT 1 FROM team_privileges existing
	WHERE existing.team_id = tp.team_id AND existing.capability = map.credit_capability
);
