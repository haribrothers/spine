CREATE TABLE "vendor_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"vendor_credit_id" uuid NOT NULL,
	"money_account_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"method" "vendor_payment_method" NOT NULL,
	"reference" text,
	"entry_id" uuid NOT NULL,
	"reversal_entry_id" uuid,
	"created_by_user_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_refunds_positive" CHECK ("vendor_refunds"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "vendor_refunds" ADD CONSTRAINT "vendor_refunds_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_refunds" ADD CONSTRAINT "vendor_refunds_vendor_credit_id_vendor_credits_id_fk" FOREIGN KEY ("vendor_credit_id") REFERENCES "public"."vendor_credits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_refunds" ADD CONSTRAINT "vendor_refunds_money_account_id_money_accounts_id_fk" FOREIGN KEY ("money_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_refunds" ADD CONSTRAINT "vendor_refunds_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_refunds" ADD CONSTRAINT "vendor_refunds_reversal_entry_id_journal_entries_id_fk" FOREIGN KEY ("reversal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_refunds" ADD CONSTRAINT "vendor_refunds_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_refunds_credit_idx" ON "vendor_refunds" USING btree ("vendor_credit_id");--> statement-breakpoint
-- US-PUR-26 (invariant 9): a credit's applications plus its live refunds
-- never exceed it. Same deferred-trigger approach as 0086, now counting refunds.
CREATE OR REPLACE FUNCTION check_vendor_credit_allocation_limits() RETURNS trigger AS $$
DECLARE
	affected_credit_id uuid;
	affected_bill_id uuid;
	credit_used bigint;
	credit_total bigint;
	bill_used bigint;
	bill_total bigint;
BEGIN
	affected_credit_id := COALESCE(NEW.vendor_credit_id, OLD.vendor_credit_id);

	SELECT COALESCE((SELECT SUM(amount) FROM vendor_credit_allocations WHERE vendor_credit_id = affected_credit_id), 0)
		+ COALESCE((SELECT SUM(amount) FROM vendor_refunds WHERE vendor_credit_id = affected_credit_id AND deleted_at IS NULL), 0)
	INTO credit_used;
	SELECT total_amount INTO credit_total FROM vendor_credits WHERE id = affected_credit_id;
	IF credit_used > credit_total THEN
		RAISE EXCEPTION 'vendor credit % applications and refunds (%) exceed its total (%)', affected_credit_id, credit_used, credit_total;
	END IF;

	IF TG_TABLE_NAME = 'vendor_credit_allocations' THEN
		affected_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);
		SELECT COALESCE((SELECT SUM(amount) FROM vendor_payment_allocations WHERE bill_id = affected_bill_id), 0)
			+ COALESCE((SELECT SUM(amount) FROM vendor_credit_allocations WHERE bill_id = affected_bill_id), 0)
		INTO bill_used;
		SELECT total_amount INTO bill_total FROM vendor_bills WHERE id = affected_bill_id;
		IF bill_used > bill_total THEN
			RAISE EXCEPTION 'vendor bill % payments and credits (%) exceed its total (%)', affected_bill_id, bill_used, bill_total;
		END IF;
	END IF;

	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER vendor_refunds_check_limits
	AFTER INSERT OR UPDATE ON vendor_refunds
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW EXECUTE FUNCTION check_vendor_credit_allocation_limits();
