-- Hand-authored (not drizzle-kit generated) — no schema change needed.
-- Adds two new independent, non-ownership capabilities:
-- `contacts.manage_persons` and `contacts.manage_addresses`. Contact
-- persons/addresses are pure sub-fields of a contact record (no creator
-- column of their own — see contacts.ts's schema comment), so "own vs
-- others" doesn't apply; instead each array gets its own single grant,
-- checked in ADDITION to `contacts.edit_own`/`edit_others` (still required
-- to touch the contact at all).
--
-- Previously the API only ever checked `contacts.edit_own`/`edit_others`
-- for the entire PUT /contacts/:id payload including these arrays — every
-- existing Team that could edit a contact could implicitly manage its
-- persons/addresses too. Backfilling both new capabilities onto every
-- Team that already has `contacts.edit_own` granted preserves that
-- existing behavior; Owners narrow per-Team afterward if they want a more
-- restrictive split.
--
-- Safe to re-run: guarded by WHERE NOT EXISTS per capability.

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, cap.capability, tp.granted
FROM team_privileges tp
CROSS JOIN (VALUES
	('contacts.manage_persons'),
	('contacts.manage_addresses')
) AS cap(capability)
WHERE tp.capability = 'contacts.edit_own'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = cap.capability
	);
