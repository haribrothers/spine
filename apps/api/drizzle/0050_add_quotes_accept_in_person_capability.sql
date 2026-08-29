-- Hand-authored (not drizzle-kit generated) — no schema change needed
-- (the accompanying quotes.acceptedByUserId/acceptanceMethod columns were
-- added by drizzle-kit generate in 0049_narrow_tyger_tiger).
--
-- Adds one new independent, non-ownership workflow capability:
-- `quotes.accept_in_person` (Phase 5, Mobile — a field/staff/owner user
-- presents a quote on their device and captures the customer's on-site
-- acceptance, S-11.7). Not an own/others pair — "who can accept a quote in
-- person" isn't an ownership question, matching `quotes.send`/
-- `quotes.revise`'s existing single-grant shape. Field always has this
-- capability unconditionally regardless of Team grants (see
-- FIELD_ALWAYS_CAPABILITIES in apps/api/src/auth/capability.util.ts) — this
-- migration only concerns Staff's Team-configurable default.
--
-- Previously there was no in-person acceptance feature at all, so there is
-- no prior behavior to strictly "preserve" — but per this codebase's
-- existing convention for new dedicated workflow capabilities on an
-- already-covered module, backfill it onto every Team that already has
-- `quotes.send` granted (the office-facing Teams that already work with
-- quotes), so an Owner doesn't have to remember to separately grant this
-- the moment mobile ships. Owners narrow per-Team afterward if they want a
-- more restrictive split.
--
-- Safe to re-run: guarded by WHERE NOT EXISTS.

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, 'quotes.accept_in_person', tp.granted
FROM team_privileges tp
WHERE tp.capability = 'quotes.send'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = 'quotes.accept_in_person'
	);
