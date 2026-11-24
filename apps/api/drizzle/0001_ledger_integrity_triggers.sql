-- Keeps journal_entries.total_debits/total_credits in sync with the sum of
-- their journal_lines. Fires after every INSERT/UPDATE/DELETE on
-- journal_lines, including mid-transaction while an entry's lines are still
-- being written — see docs/spine-prd.md §6.3.
CREATE FUNCTION sync_journal_entry_totals() RETURNS trigger AS $$
DECLARE
	affected_entry_id uuid;
BEGIN
	affected_entry_id := COALESCE(NEW.entry_id, OLD.entry_id);

	PERFORM set_config('spine.syncing_totals', 'on', true);
	UPDATE journal_entries
	SET total_debits = COALESCE((SELECT SUM(debit) FROM journal_lines WHERE entry_id = affected_entry_id), 0),
	    total_credits = COALESCE((SELECT SUM(credit) FROM journal_lines WHERE entry_id = affected_entry_id), 0)
	WHERE id = affected_entry_id;
	PERFORM set_config('spine.syncing_totals', 'off', true);

	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER journal_lines_sync_totals
	AFTER INSERT OR UPDATE OR DELETE ON journal_lines
	FOR EACH ROW EXECUTE FUNCTION sync_journal_entry_totals();
--> statement-breakpoint

-- Enforces debits == credits per entry — the one non-negotiable invariant
-- in the whole schema. This has to be a DEFERRABLE constraint trigger
-- rather than a plain CHECK: a plain CHECK on journal_entries evaluates
-- after every single-row UPDATE from the sync trigger above, which would
-- reject an entry the instant its first line lands, before the offsetting
-- line is inserted. Deferring to COMMIT lets a whole entry's lines land
-- first, then validates the total once, atomically.
CREATE FUNCTION check_journal_entry_balanced() RETURNS trigger AS $$
DECLARE
	affected_entry_id uuid;
	entry_debits bigint;
	entry_credits bigint;
BEGIN
	affected_entry_id := COALESCE(NEW.entry_id, OLD.entry_id);

	SELECT total_debits, total_credits INTO entry_debits, entry_credits
	FROM journal_entries WHERE id = affected_entry_id;

	IF entry_debits IS DISTINCT FROM entry_credits THEN
		RAISE EXCEPTION 'journal_entry % is unbalanced: debits % != credits %', affected_entry_id, entry_debits, entry_credits;
	END IF;

	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER journal_lines_check_balanced
	AFTER INSERT OR UPDATE OR DELETE ON journal_lines
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW EXECUTE FUNCTION check_journal_entry_balanced();
--> statement-breakpoint

-- Journal entries and lines are immutable once written (§6.3) — corrections
-- post a reversing entry, never an edit. The sync trigger above is the only
-- thing permitted to update total_debits/total_credits after insert; it
-- flags its own updates with a session-local GUC so this trigger can tell
-- them apart from a direct app-level UPDATE. (Comparing OLD/NEW values
-- instead is unreliable here: within one multi-row INSERT INTO journal_lines
-- statement, the nested per-row UPDATE journal_entries calls don't each see
-- a fresh OLD snapshot, so a same-statement second line's totals update can
-- misfire the "is this a real edit" check.)
CREATE FUNCTION reject_journal_entry_mutation() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'UPDATE' THEN
		IF current_setting('spine.syncing_totals', true) = 'on' THEN
			RETURN NEW;
		END IF;
		IF NEW.reversed_by_id IS DISTINCT FROM OLD.reversed_by_id AND OLD.reversed_by_id IS NULL THEN
			-- allowed: marking an entry as reversed, exactly once
			RETURN NEW;
		END IF;
		RAISE EXCEPTION 'journal_entries are immutable; post a reversing entry instead of editing %', OLD.id;
	ELSIF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'journal_entries cannot be deleted; post a reversing entry instead of deleting %', OLD.id;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER journal_entries_reject_mutation
	BEFORE UPDATE OR DELETE ON journal_entries
	FOR EACH ROW EXECUTE FUNCTION reject_journal_entry_mutation();
--> statement-breakpoint

CREATE FUNCTION reject_journal_line_mutation() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'UPDATE' THEN
		RAISE EXCEPTION 'journal_lines are immutable; post a reversing entry instead of editing %', OLD.id;
	ELSIF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'journal_lines cannot be deleted; post a reversing entry instead of deleting %', OLD.id;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER journal_lines_reject_mutation
	BEFORE UPDATE OR DELETE ON journal_lines
	FOR EACH ROW EXECUTE FUNCTION reject_journal_line_mutation();