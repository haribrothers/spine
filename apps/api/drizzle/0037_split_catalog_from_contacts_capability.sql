-- Hand-authored (not drizzle-kit generated) — same pattern as
-- 0033_backfill_meetings_manage_capability.sql and
-- 0036_split_contacts_manage_capability.sql. Contacts and Catalogue used to
-- share one set of four ownership-aware capabilities
-- (`contacts.edit_own`/`edit_others`/`delete_own`/`delete_others`, added in
-- 0036); they are now independently configurable per Team (PRD §9
-- S-01.15/S-02.5's UI acceptance criteria — "Manage Contacts" and "Manage
-- Catalogue" are separate groups in the privilege matrix), via a new
-- parallel `catalog.*` capability family with identical semantics.
--
-- Every team's existing `contacts.edit_own`/`edit_others`/`delete_own`/
-- `delete_others` grant is copied verbatim into the matching `catalog.*`
-- capability — since the two were governed by the same underlying
-- capability until now, this is the only value that preserves each team's
-- actual pre-split Catalogue access exactly (whatever it could do to
-- contacts, it could equally do to catalogue items, because it was
-- literally the same check).
--
-- Safe to re-run: guarded by WHERE NOT EXISTS per capability, so running
-- this twice is a no-op the second time.

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, REPLACE(tp.capability, 'contacts.', 'catalog.'), tp.granted
FROM team_privileges tp
WHERE tp.capability IN ('contacts.edit_own', 'contacts.edit_others', 'contacts.delete_own', 'contacts.delete_others')
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = REPLACE(tp.capability, 'contacts.', 'catalog.')
	);
