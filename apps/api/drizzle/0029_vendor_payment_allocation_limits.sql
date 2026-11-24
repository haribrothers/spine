-- S-07.8 — exact mirror of 0020_payment_allocation_limits.sql for the
-- vendor side: allocations can never exceed either the vendor payment's
-- own amount or the vendor bill's own total, enforced at the database
-- level via a deferred constraint trigger (not just app-level checks),
-- same "cross-row invariant needs a trigger, not a per-row CHECK" reasoning
-- as the customer-side table. vendor_payments.allocated_amount is kept in
-- sync here too, same belt-and-suspenders split (app check = fast, clear
-- rejection; DB trigger = actual enforcement).
CREATE FUNCTION check_vendor_payment_allocation_limits() RETURNS trigger AS $$
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

	SELECT COALESCE(SUM(vpa.amount), 0) INTO bill_allocated
	FROM vendor_payment_allocations vpa WHERE vpa.bill_id = affected_bill_id;

	SELECT total_amount INTO bill_total FROM vendor_bills WHERE id = affected_bill_id;

	IF bill_allocated > bill_total THEN
		RAISE EXCEPTION 'vendor bill % allocations (%) exceed its own total (%)', affected_bill_id, bill_allocated, bill_total;
	END IF;

	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER vendor_payment_allocations_check_limits
	AFTER INSERT OR UPDATE OR DELETE ON vendor_payment_allocations
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW EXECUTE FUNCTION check_vendor_payment_allocation_limits();
