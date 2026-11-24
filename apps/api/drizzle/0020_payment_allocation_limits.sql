-- PRD §6/F6 acceptance highlight: "allocations can never exceed either the
-- payment amount or the invoice balance — enforced at the database level,
-- not just the UI." payment_allocations' own per-row CHECK (amount > 0)
-- can't express this — it's a cross-row invariant (sum of a payment's
-- allocations, sum of an invoice's allocations against that invoice's
-- total) — so, exactly like journal_lines' balance check
-- (0001_ledger_integrity_triggers.sql), this needs a trigger that re-sums
-- on every insert/update/delete, deferred to COMMIT so a multi-row
-- allocation batch (S-06.2: one payment split across several invoices) can
-- be written as several inserts within one transaction without an
-- intermediate row tripping the check before the batch is complete.
--
-- payments.allocated_amount is kept in sync here too (not solely by
-- application code) so the invariant holds even if a future caller ever
-- writes payment_allocations directly — the same "app-level check is a
-- fast, clear early rejection; the DB trigger is the actual enforcement"
-- split used throughout this schema.
CREATE FUNCTION check_payment_allocation_limits() RETURNS trigger AS $$
DECLARE
	affected_payment_id uuid;
	affected_invoice_id uuid;
	payment_amount bigint;
	payment_allocated bigint;
	invoice_total bigint;
	invoice_allocated bigint;
BEGIN
	affected_payment_id := COALESCE(NEW.payment_id, OLD.payment_id);
	affected_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

	SELECT COALESCE(SUM(amount), 0) INTO payment_allocated
	FROM payment_allocations WHERE payment_id = affected_payment_id;

	SELECT amount INTO payment_amount FROM payments WHERE id = affected_payment_id;

	IF payment_allocated > payment_amount THEN
		RAISE EXCEPTION 'payment % allocations (%) exceed its own amount (%)', affected_payment_id, payment_allocated, payment_amount;
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
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER payment_allocations_check_limits
	AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW EXECUTE FUNCTION check_payment_allocation_limits();
--> statement-breakpoint

-- payment_allocations rows are immutable/never-deleted by the application
-- (see PaymentsService — an allocation, once posted, is permanent
-- financial history; "undo" isn't a Stage 1 story), but nothing at the
-- schema level currently prevents a direct UPDATE/DELETE the way
-- journal_lines' own reject-mutation trigger does. Deliberately NOT adding
-- that guard here: unlike journal_lines (whose immutability is a
-- Spine's non-negotiable with its own PRD wording), payment_allocations
-- has no such explicit PRD requirement, and application code is the only
-- writer today — revisit if a future story needs allocations to be
-- editable (e.g. correcting a mis-allocated split) rather than only
-- reversible by deleting the whole payment (Stage 1's only mutation path,
-- see PaymentsService.delete's own guard).
