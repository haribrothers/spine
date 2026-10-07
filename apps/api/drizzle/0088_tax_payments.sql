CREATE TYPE "public"."tax_payment_kind" AS ENUM('payment', 'refund');--> statement-breakpoint
CREATE TABLE "tax_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"kind" "tax_payment_kind" NOT NULL,
	"period_from" date,
	"period_to" date,
	"input_tax_used" bigint DEFAULT 0 NOT NULL,
	"amount" bigint NOT NULL,
	"money_account_id" uuid,
	"date" date NOT NULL,
	"reference" text,
	"entry_id" uuid NOT NULL,
	"reversal_entry_id" uuid,
	"created_by_user_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_payments_amounts" CHECK ("tax_payments"."amount" >= 0 AND "tax_payments"."input_tax_used" >= 0 AND "tax_payments"."amount" + "tax_payments"."input_tax_used" > 0),
	CONSTRAINT "tax_payments_kind_shape" CHECK (("tax_payments"."kind" = 'payment' AND "tax_payments"."period_from" IS NOT NULL AND "tax_payments"."period_to" IS NOT NULL AND "tax_payments"."period_from" <= "tax_payments"."period_to") OR ("tax_payments"."kind" = 'refund' AND "tax_payments"."input_tax_used" = 0 AND "tax_payments"."amount" > 0 AND "tax_payments"."money_account_id" IS NOT NULL)),
	CONSTRAINT "tax_payments_money_account" CHECK ("tax_payments"."amount" = 0 OR "tax_payments"."money_account_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "tax_payments" ADD CONSTRAINT "tax_payments_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_payments" ADD CONSTRAINT "tax_payments_money_account_id_money_accounts_id_fk" FOREIGN KEY ("money_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_payments" ADD CONSTRAINT "tax_payments_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_payments" ADD CONSTRAINT "tax_payments_reversal_entry_id_journal_entries_id_fk" FOREIGN KEY ("reversal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_payments" ADD CONSTRAINT "tax_payments_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tax_payments_org_date_idx" ON "tax_payments" USING btree ("org_id","date");