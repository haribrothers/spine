CREATE TABLE "customer_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"source_payment_id" uuid,
	"source_credit_note_id" uuid,
	"money_account_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text,
	"entry_id" uuid NOT NULL,
	"reversal_entry_id" uuid,
	"created_by_user_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_refunds_positive" CHECK ("customer_refunds"."amount" > 0),
	CONSTRAINT "customer_refunds_one_source" CHECK (("customer_refunds"."source_payment_id" IS NULL) <> ("customer_refunds"."source_credit_note_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_source_payment_id_payments_id_fk" FOREIGN KEY ("source_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_source_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("source_credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_money_account_id_money_accounts_id_fk" FOREIGN KEY ("money_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_reversal_entry_id_journal_entries_id_fk" FOREIGN KEY ("reversal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_refunds_contact_idx" ON "customer_refunds" USING btree ("org_id","contact_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_not_negative" CHECK ("payments"."refunded_amount" >= 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_allocated_and_refunded_within_amount" CHECK ("payments"."allocated_amount" + "payments"."refunded_amount" <= "payments"."amount");--> statement-breakpoint
-- US-PAY-18: refunding customers is its own right, off for every existing Team.
INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), t.id, 'payments.refund', false
FROM teams t
WHERE NOT EXISTS (
	SELECT 1 FROM team_privileges existing
	WHERE existing.team_id = t.id AND existing.capability = 'payments.refund'
);
