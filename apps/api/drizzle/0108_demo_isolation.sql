ALTER TABLE "number_sequences" DROP CONSTRAINT "number_sequences_org_doctype_unique";--> statement-breakpoint
ALTER TABLE "number_sequences" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_org_doctype_demo_unique" UNIQUE("org_id","document_type","is_demo");--> statement-breakpoint
-- US-ONB-17 (D-191): journal entries stay immutable, except that "Delete all
-- demo data" (which sets spine.deleting_demo for its own transaction) may
-- delete entries flagged is_demo, and their lines. A real entry can't be
-- deleted, in that transaction or any other.
CREATE OR REPLACE FUNCTION reject_journal_entry_mutation() RETURNS trigger AS $$
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
		IF OLD.is_demo AND current_setting('spine.deleting_demo', true) = 'on' THEN
			RETURN OLD;
		END IF;
		RAISE EXCEPTION 'journal_entries cannot be deleted; post a reversing entry instead of deleting %', OLD.id;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_journal_line_mutation() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'UPDATE' THEN
		IF (to_jsonb(NEW) - 'reconciliation_id') = (to_jsonb(OLD) - 'reconciliation_id') THEN
			RETURN NEW;
		END IF;
		RAISE EXCEPTION 'journal_lines are immutable; post a reversing entry instead of editing %', OLD.id;
	ELSIF TG_OP = 'DELETE' THEN
		-- The entry is already gone when its delete cascades here; it was demo, or it couldn't have been deleted.
		IF current_setting('spine.deleting_demo', true) = 'on' AND COALESCE((SELECT is_demo FROM journal_entries WHERE id = OLD.entry_id), true) THEN
			RETURN OLD;
		END IF;
		RAISE EXCEPTION 'journal_lines cannot be deleted; post a reversing entry instead of deleting %', OLD.id;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- US-ONB-17 (D-191): a document saved for a demo contact is demo too. A
-- draft moved to another contact takes that contact's flag.
CREATE FUNCTION inherit_demo_from_contact() RETURNS trigger AS $$
DECLARE
	contact_demo boolean;
BEGIN
	IF NEW.contact_id IS NULL THEN
		RETURN NEW;
	END IF;
	IF TG_OP = 'UPDATE' AND NEW.contact_id IS NOT DISTINCT FROM OLD.contact_id THEN
		RETURN NEW;
	END IF;
	SELECT is_demo INTO contact_demo FROM contacts WHERE id = NEW.contact_id;
	IF TG_OP = 'INSERT' THEN
		NEW.is_demo := NEW.is_demo OR COALESCE(contact_demo, false);
	ELSE
		NEW.is_demo := COALESCE(contact_demo, false);
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER quotes_inherit_demo BEFORE INSERT OR UPDATE OF contact_id ON quotes FOR EACH ROW EXECUTE FUNCTION inherit_demo_from_contact();
--> statement-breakpoint
CREATE TRIGGER invoices_inherit_demo BEFORE INSERT OR UPDATE OF contact_id ON invoices FOR EACH ROW EXECUTE FUNCTION inherit_demo_from_contact();
--> statement-breakpoint
CREATE TRIGGER payments_inherit_demo BEFORE INSERT OR UPDATE OF contact_id ON payments FOR EACH ROW EXECUTE FUNCTION inherit_demo_from_contact();
--> statement-breakpoint
CREATE TRIGGER credit_notes_inherit_demo BEFORE INSERT OR UPDATE OF contact_id ON credit_notes FOR EACH ROW EXECUTE FUNCTION inherit_demo_from_contact();
--> statement-breakpoint
CREATE TRIGGER vendor_bills_inherit_demo BEFORE INSERT OR UPDATE OF contact_id ON vendor_bills FOR EACH ROW EXECUTE FUNCTION inherit_demo_from_contact();
--> statement-breakpoint
CREATE TRIGGER vendor_payments_inherit_demo BEFORE INSERT OR UPDATE OF contact_id ON vendor_payments FOR EACH ROW EXECUTE FUNCTION inherit_demo_from_contact();
--> statement-breakpoint
CREATE TRIGGER jobs_inherit_demo BEFORE INSERT OR UPDATE OF contact_id ON jobs FOR EACH ROW EXECUTE FUNCTION inherit_demo_from_contact();
--> statement-breakpoint
-- An expense on a demo job is demo too.
CREATE FUNCTION inherit_demo_from_job() RETURNS trigger AS $$
DECLARE
	job_demo boolean;
BEGIN
	IF NEW.job_id IS NULL THEN
		RETURN NEW;
	END IF;
	IF TG_OP = 'UPDATE' AND NEW.job_id IS NOT DISTINCT FROM OLD.job_id THEN
		RETURN NEW;
	END IF;
	SELECT is_demo INTO job_demo FROM jobs WHERE id = NEW.job_id;
	IF TG_OP = 'INSERT' THEN
		NEW.is_demo := NEW.is_demo OR COALESCE(job_demo, false);
	ELSE
		NEW.is_demo := COALESCE(job_demo, false);
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER expenses_inherit_demo BEFORE INSERT OR UPDATE OF job_id ON expenses FOR EACH ROW EXECUTE FUNCTION inherit_demo_from_job();
--> statement-breakpoint
-- Entries already posted for demo documents get the flag once, so deleting
-- that demo data removes them too. The immutability trigger is off only for
-- this one statement.
ALTER TABLE journal_entries DISABLE TRIGGER journal_entries_reject_mutation;
--> statement-breakpoint
UPDATE journal_entries je SET is_demo = true
WHERE (je.source_type ~ '^credit_note(_|$)' AND EXISTS (SELECT 1 FROM credit_notes d WHERE d.id = je.source_id AND d.is_demo))
	OR (je.source_type ~ '^vendor_payment(_|$)' AND EXISTS (SELECT 1 FROM vendor_payments d WHERE d.id = je.source_id AND d.is_demo))
	OR (je.source_type ~ '^vendor_bill(_|$)' AND EXISTS (SELECT 1 FROM vendor_bills d WHERE d.id = je.source_id AND d.is_demo))
	OR (je.source_type ~ '^invoice(_|$)' AND EXISTS (SELECT 1 FROM invoices d WHERE d.id = je.source_id AND d.is_demo))
	OR (je.source_type ~ '^payment(_|$)' AND EXISTS (SELECT 1 FROM payments d WHERE d.id = je.source_id AND d.is_demo))
	OR (je.source_type ~ '^expense(_|$)' AND EXISTS (SELECT 1 FROM expenses d WHERE d.id = je.source_id AND d.is_demo));
--> statement-breakpoint
ALTER TABLE journal_entries ENABLE TRIGGER journal_entries_reject_mutation;
