-- Hand-authored (not drizzle-kit generated) — same pattern as
-- 0036_split_contacts_manage_capability.sql and
-- 0037_split_catalog_from_contacts_capability.sql. `leads.manage` (a single
-- capability gating create/edit/delete on both Leads and Activities
-- together) is replaced by two independent "own vs others" capability
-- groups (PRD §9 S-01.16): `leads.edit_own`/`edit_others`/`delete_own`/
-- `delete_others` for Leads, and `activities.edit_own`/`edit_others`/
-- `delete_own`/`delete_others` for Activities.
--
-- Every team that granted `leads.manage: true` gets all eight new rows set
-- to `true` (preserving full pre-split access exactly, matching
-- DEFAULT_TEAM_GRANTS' own default of all-true for a freshly seeded org);
-- a team that had it explicitly `false` gets all eight set to `false`.
-- New orgs don't need this — seedDefaultTeam() already reads
-- DEFAULT_TEAM_GRANTS for freshly-created teams.
--
-- Safe to re-run: guarded by WHERE NOT EXISTS per capability, so running
-- this twice is a no-op the second time. The final DELETE removes the now-
-- meaningless `leads.manage` rows.

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, cap.capability, tp.granted
FROM team_privileges tp
CROSS JOIN (VALUES
	('leads.edit_own'),
	('leads.edit_others'),
	('leads.delete_own'),
	('leads.delete_others'),
	('activities.edit_own'),
	('activities.edit_others'),
	('activities.delete_own'),
	('activities.delete_others')
) AS cap(capability)
WHERE tp.capability = 'leads.manage'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = cap.capability
	);

DELETE FROM team_privileges WHERE capability = 'leads.manage';
