-- Hand-authored (not drizzle-kit generated) — backfills the new
-- `meetings.manage` capability (added in 0032_meeting_visibility_attendees.sql
-- via a plain code change, since team_privileges.capability is free text
-- with no migration required to add a new capability id) for organisations
-- that already existed before this capability was introduced.
--
-- meetings.manage replaces contacts.manage's previous piggyback on
-- create/update/delete meeting endpoints (see meetings.controller.ts).
-- Without this backfill, every existing team would default to
-- meetings.manage: false via the ?? false fallback in teams.service.ts,
-- silently taking meeting-management away from staff who could do it
-- yesterday. New orgs don't need this — seedDefaultTeam() already reads
-- DEFAULT_TEAM_GRANTS (meetings.manage: true) for freshly-created teams.
--
-- Safe to re-run: guarded by WHERE NOT EXISTS, so running this twice is a
-- no-op the second time.

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, 'meetings.manage', tp.granted
FROM team_privileges tp
WHERE tp.capability = 'contacts.manage'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = 'meetings.manage'
	);
