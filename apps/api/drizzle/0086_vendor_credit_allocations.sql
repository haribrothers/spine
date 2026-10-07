CREATE TABLE "vendor_credit_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"vendor_credit_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_credit_allocations_positive" CHECK ("vendor_credit_allocations"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD COLUMN "credited_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_credit_allocations" ADD CONSTRAINT "vendor_credit_allocations_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit_allocations" ADD CONSTRAINT "vendor_credit_allocations_vendor_credit_id_vendor_credits_id_fk" FOREIGN KEY ("vendor_credit_id") REFERENCES "public"."vendor_credits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit_allocations" ADD CONSTRAINT "vendor_credit_allocations_bill_id_vendor_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."vendor_bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_credit_allocations" ADD CONSTRAINT "vendor_credit_allocations_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_credit_allocations_credit_idx" ON "vendor_credit_allocations" USING btree ("vendor_credit_id");--> statement-breakpoint
CREATE INDEX "vendor_credit_allocations_bill_idx" ON "vendor_credit_allocations" USING btree ("bill_id");--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_paid_and_credited_within_total" CHECK ("vendor_bills"."amount_paid" + "vendor_bills"."credited_amount" <= "vendor_bills"."total_amount");--> statement-breakpoint
-- US-PUR-25 (invariant 9): a vendor credit's allocations never exceed the
-- credit, and a bill's payments plus credits never exceed the bill. A
-- deferred constraint trigger, like 0029 for vendor payments (a cross-row
-- sum needs a trigger, not a per-row CHECK). US-PUR-26 adds refunds to the
-- credit side.
CREATE FUNCTION check_vendor_credit_allocation_limits() RETURNS trigger AS $$
DECLARE
	affected_credit_id uuid;
	affected_bill_id uuid;
	credit_used bigint;
	credit_total bigint;
	bill_used bigint;
	bill_total bigint;
BEGIN
	affected_credit_id := COALESCE(NEW.vendor_credit_id, OLD.vendor_credit_id);
	affected_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);

	SELECT COALESCE(SUM(amount), 0) INTO credit_used FROM vendor_credit_allocations WHERE vendor_credit_id = affected_credit_id;
	SELECT total_amount INTO credit_total FROM vendor_credits WHERE id = affected_credit_id;
	IF credit_used > credit_total THEN
		RAISE EXCEPTION 'vendor credit % allocations (%) exceed its total (%)', affected_credit_id, credit_used, credit_total;
	END IF;

	SELECT COALESCE((SELECT SUM(amount) FROM vendor_payment_allocations WHERE bill_id = affected_bill_id), 0)
		+ COALESCE((SELECT SUM(amount) FROM vendor_credit_allocations WHERE bill_id = affected_bill_id), 0)
	INTO bill_used;
	SELECT total_amount INTO bill_total FROM vendor_bills WHERE id = affected_bill_id;
	IF bill_used > bill_total THEN
		RAISE EXCEPTION 'vendor bill % payments and credits (%) exceed its total (%)', affected_bill_id, bill_used, bill_total;
	END IF;

	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER vendor_credit_allocations_check_limits
	AFTER INSERT OR UPDATE OR DELETE ON vendor_credit_allocations
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW EXECUTE FUNCTION check_vendor_credit_allocation_limits();
--> statement-breakpoint
-- Vendor payments now share the bill with credits.
CREATE OR REPLACE FUNCTION check_vendor_payment_allocation_limits() RETURNS trigger AS $$
DECLARE
	affected_payment_id uuid;
	affected_bill_id uuid;
	payment_amount bigint;
	payment_allocated bigint;
	bill_total bigint;
	bill_allocated bigint;
BEGIN
	affected_payment_id := COALESCE(NEW.vendor_payment_id, OLD.vendor_payment_id);
	affected_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);

	SELECT COALESCE(SUM(amount), 0) INTO payment_allocated
	FROM vendor_payment_allocations WHERE vendor_payment_id = affected_payment_id;

	SELECT amount INTO payment_amount FROM vendor_payments WHERE id = affected_payment_id;

	IF payment_allocated > payment_amount THEN
		RAISE EXCEPTION 'vendor payment % allocations (%) exceed its own amount (%)', affected_payment_id, payment_allocated, payment_amount;
	END IF;

	UPDATE vendor_payments SET allocated_amount = payment_allocated, updated_at = now() WHERE id = affected_payment_id;

	SELECT COALESCE((SELECT SUM(amount) FROM vendor_payment_allocations WHERE bill_id = affected_bill_id), 0)
		+ COALESCE((SELECT SUM(amount) FROM vendor_credit_allocations WHERE bill_id = affected_bill_id), 0)
	INTO bill_allocated;

	SELECT total_amount INTO bill_total FROM vendor_bills WHERE id = affected_bill_id;

	IF bill_allocated > bill_total THEN
		RAISE EXCEPTION 'vendor bill % allocations (%) exceed its own total (%)', affected_bill_id, bill_allocated, bill_total;
	END IF;

	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
