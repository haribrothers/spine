-- Hand-authored (not drizzle-kit generated) — same pattern as
-- 0033_backfill_meetings_manage_capability.sql. `contacts.manage` (a single
-- capability gating create/edit/archive/restore/delete on both Contacts and
-- Catalogue together) is replaced by five capabilities: the "own vs
-- others" split for Contacts/Catalogue (`contacts.edit_own`,
-- `contacts.edit_others`, `contacts.delete_own`, `contacts.delete_others`
-- — PRD §9 S-01.15/S-02.5) plus `leads.manage` for Leads/Activities, which
-- were also gated by `contacts.manage` but are explicitly out of scope for
-- the ownership split (CLAUDE.md's permission-model section).
--
-- Every team that granted `contacts.manage: true` gets all five new rows
-- set to `true` (preserving full pre-split access exactly, matching
-- CAPABILITY_LABELS/DEFAULT_TEAM_GRANTS' own default of all-true for a
-- freshly seeded org); a team that had it explicitly `false` gets all five
-- set to `false`. New orgs don't need this — seedDefaultTeam() already
-- reads DEFAULT_TEAM_GRANTS for freshly-created teams.
--
-- Safe to re-run: guarded by WHERE NOT EXISTS per capability, so running
-- this twice is a no-op the second time. The final DELETE removes the now-
-- meaningless `contacts.manage` rows (CAPABILITIES no longer includes it,
-- so nothing reads these rows going forward regardless, but leaving them
-- behind would be confusing dead data in the table).

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, cap.capability, tp.granted
FROM team_privileges tp
CROSS JOIN (VALUES
	('contacts.edit_own'),
	('contacts.edit_others'),
	('contacts.delete_own'),
	('contacts.delete_others'),
	('leads.manage')
) AS cap(capability)
WHERE tp.capability = 'contacts.manage'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = cap.capability
	);

DELETE FROM team_privileges WHERE capability = 'contacts.manage';
