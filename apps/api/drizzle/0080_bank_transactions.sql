CREATE TYPE "public"."bank_transaction_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"money_account_id" uuid NOT NULL,
	"direction" "bank_transaction_direction" NOT NULL,
	"account_id" uuid NOT NULL,
	"contact_id" uuid,
	"amount" bigint NOT NULL,
	"tax_rate_id" uuid,
	"tax_group_id" uuid,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"date" date NOT NULL,
	"description" text,
	"entry_id" uuid NOT NULL,
	"reversal_entry_id" uuid,
	"created_by_user_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_transactions_positive_amount" CHECK ("bank_transactions"."amount" > 0),
	CONSTRAINT "bank_transactions_tax_within_amount" CHECK ("bank_transactions"."tax_amount" >= 0 AND "bank_transactions"."tax_amount" < "bank_transactions"."amount")
);
--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_money_account_id_money_accounts_id_fk" FOREIGN KEY ("money_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_tax_group_id_tax_groups_id_fk" FOREIGN KEY ("tax_group_id") REFERENCES "public"."tax_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_reversal_entry_id_journal_entries_id_fk" FOREIGN KEY ("reversal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_transactions_org_date_idx" ON "bank_transactions" USING btree ("org_id","date");--> statement-breakpoint
-- US-BANK-05 (D-174): 4800 Interest Received for the "Interest received"
-- shortcut, in every organisation that hasn't used code 4800. Safe to re-run.
INSERT INTO "accounts" ("org_id", "code", "name", "type", "is_system")
SELECT o."id", '4800', 'Interest Received', 'income', false
FROM "organization" o
WHERE NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."org_id" = o."id" AND a."code" = '4800');
