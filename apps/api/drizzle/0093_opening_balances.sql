CREATE TYPE "public"."opening_balance_status" AS ENUM('draft', 'locked');--> statement-breakpoint
CREATE TABLE "opening_balance_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"debit" bigint DEFAULT 0 NOT NULL,
	"credit" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "opening_balance_lines_one_sided" CHECK ("opening_balance_lines"."debit" >= 0 AND "opening_balance_lines"."credit" >= 0 AND ("opening_balance_lines"."debit" = 0 OR "opening_balance_lines"."credit" = 0) AND "opening_balance_lines"."debit" + "opening_balance_lines"."credit" > 0)
);
--> statement-breakpoint
CREATE TABLE "opening_balances" (
	"org_id" text PRIMARY KEY NOT NULL,
	"cutover_date" date NOT NULL,
	"status" "opening_balance_status" DEFAULT 'draft' NOT NULL,
	"entry_id" uuid,
	"locked_at" timestamp with time zone,
	"locked_by_user_id" text,
	"fiscal_period_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_locked_by_user_id_user_id_fk" FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_fiscal_period_id_fiscal_periods_id_fk" FOREIGN KEY ("fiscal_period_id") REFERENCES "public"."fiscal_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opening_balance_lines_account_uidx" ON "opening_balance_lines" USING btree ("org_id","account_id");--> statement-breakpoint
-- US-RPT-16 (D-137): 3900 Opening Balance Adjustments (equity, system) in every
-- organisation that doesn't have code 3900 yet. Safe to re-run.
INSERT INTO "accounts" ("org_id", "code", "name", "type", "is_system")
SELECT o."id", '3900', 'Opening Balance Adjustments', 'equity', true
FROM "organization" o
WHERE NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."org_id" = o."id" AND a."code" = '3900');
