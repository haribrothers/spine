ALTER TABLE "journal_lines" ADD COLUMN "reconciliation_id" uuid;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_reconciliation_id_bank_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."bank_reconciliations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_lines_reconciliation_idx" ON "journal_lines" USING btree ("reconciliation_id");--> statement-breakpoint
-- US-BANK-10: journal lines stay immutable, except that finishing or undoing
-- a reconciliation may set or clear reconciliation_id (nothing else).
CREATE OR REPLACE FUNCTION reject_journal_line_mutation() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'UPDATE' THEN
		IF (to_jsonb(NEW) - 'reconciliation_id') = (to_jsonb(OLD) - 'reconciliation_id') THEN
			RETURN NEW;
		END IF;
		RAISE EXCEPTION 'journal_lines are immutable; post a reversing entry instead of editing %', OLD.id;
	ELSIF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'journal_lines cannot be deleted; post a reversing entry instead of deleting %', OLD.id;
	END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
