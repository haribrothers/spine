-- Hand-authored (not drizzle-kit generated) — same pattern as
-- 0036/0037/0039. `quotes.manage` and `meetings.manage` (single
-- capabilities each gating create/update/delete, plus quotes' own
-- send/revise transitions) are replaced by own/others capability groups
-- (PRD §9, Phase 1 of extending the pattern beyond Contacts/Catalogue/
-- Leads/Activities): `quotes.edit_own`/`edit_others`/`delete_own`/
-- `delete_others`/`send`/`revise`, and `meetings.edit_own`/`edit_others`/
-- `delete_own`/`delete_others`.
--
-- Every team that granted `quotes.manage: true` gets all six new quotes.*
-- rows set to `true` (send/revise included, since they were previously
-- covered by the same single capability); a team that had it `false` gets
-- all six `false`. Same for `meetings.manage` → the four new meetings.*
-- rows. New orgs don't need this — seedDefaultTeam() already reads
-- DEFAULT_TEAM_GRANTS for freshly-created teams.
--
-- Safe to re-run: guarded by WHERE NOT EXISTS per capability, so running
-- this twice is a no-op the second time. The final DELETEs remove the now-
-- meaningless old rows.

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, cap.capability, tp.granted
FROM team_privileges tp
CROSS JOIN (VALUES
	('quotes.edit_own'),
	('quotes.edit_others'),
	('quotes.delete_own'),
	('quotes.delete_others'),
	('quotes.send'),
	('quotes.revise')
) AS cap(capability)
WHERE tp.capability = 'quotes.manage'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = cap.capability
	);

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, cap.capability, tp.granted
FROM team_privileges tp
CROSS JOIN (VALUES
	('meetings.edit_own'),
	('meetings.edit_others'),
	('meetings.delete_own'),
	('meetings.delete_others')
) AS cap(capability)
WHERE tp.capability = 'meetings.manage'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = cap.capability
	);

DELETE FROM team_privileges WHERE capability IN ('quotes.manage', 'meetings.manage');
