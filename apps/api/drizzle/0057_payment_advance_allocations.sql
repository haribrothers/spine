-- US-PAY-13 (D-075): a payment can be allocated to the advance (deposit)
-- invoice that requested it. That marks the deposit request paid, but the
-- money stays in 2200 Customer Advances until it's applied to a later
-- invoice — so allocations to advance invoices don't use up the payment's
-- credit: payments.allocated_amount (and so the credit still available,
-- amount − allocated_amount) counts only allocations to other invoices.
-- Every limit still holds: a payment's allocations to advance invoices, and
-- to all other invoices, each stay within its amount, and no invoice is
-- allocated more than its total.
CREATE OR REPLACE FUNCTION check_payment_allocation_limits() RETURNS trigger AS $$
DECLARE
	affected_payment_id uuid;
	affected_invoice_id uuid;
	payment_amount bigint;
	payment_allocated bigint;
	payment_advance_allocated bigint;
	invoice_total bigint;
	invoice_allocated bigint;
BEGIN
	affected_payment_id := COALESCE(NEW.payment_id, OLD.payment_id);
	affected_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

	SELECT
		COALESCE(SUM(pa.amount) FILTER (WHERE i.type <> 'advance'), 0),
		COALESCE(SUM(pa.amount) FILTER (WHERE i.type = 'advance'), 0)
	INTO payment_allocated, payment_advance_allocated
	FROM payment_allocations pa
	JOIN invoices i ON i.id = pa.invoice_id
	WHERE pa.payment_id = affected_payment_id;

	SELECT amount INTO payment_amount FROM payments WHERE id = affected_payment_id;

	IF payment_allocated > payment_amount THEN
		RAISE EXCEPTION 'payment % allocations (%) exceed its own amount (%)', affected_payment_id, payment_allocated, payment_amount;
	END IF;
	IF payment_advance_allocated > payment_amount THEN
		RAISE EXCEPTION 'payment % advance-invoice allocations (%) exceed its own amount (%)', affected_payment_id, payment_advance_allocated, payment_amount;
	END IF;

	PERFORM set_config('spine.syncing_payment_allocated', 'on', true);
	UPDATE payments SET allocated_amount = payment_allocated, updated_at = now() WHERE id = affected_payment_id;
	PERFORM set_config('spine.syncing_payment_allocated', 'off', true);

	SELECT COALESCE(SUM(pa.amount), 0) INTO invoice_allocated
	FROM payment_allocations pa WHERE pa.invoice_id = affected_invoice_id;

	SELECT total_amount INTO invoice_total FROM invoices WHERE id = affected_invoice_id;

	IF invoice_allocated > invoice_total THEN
		RAISE EXCEPTION 'invoice % allocations (%) exceed its own total (%)', affected_invoice_id, invoice_allocated, invoice_total;
	END IF;

	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
