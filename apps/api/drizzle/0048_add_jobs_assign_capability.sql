-- Hand-authored (not drizzle-kit generated) — no schema change needed.
-- Adds one new independent, non-ownership capability: `jobs.assign`
-- (Phase 5, Mobile — decides who's on a job's crew and therefore sees it
-- on their mobile home screen, S-11.2). Not an own/others pair — "who can
-- assign the crew" isn't an ownership question, matching
-- `jobs.release_retention`'s identical single-grant shape.
--
-- Previously there was no crew-assignment feature at all, so there is no
-- prior behavior to strictly "preserve" — but per this codebase's existing
-- convention for new Jobs-family workflow capabilities, backfill it onto
-- every Team that already has `jobs.edit_own` granted (the office-facing
-- Teams that already manage jobs), so an Owner doesn't have to remember to
-- separately grant this to every existing Team the moment mobile ships.
-- Owners narrow per-Team afterward if they want a more restrictive split.
--
-- Safe to re-run: guarded by WHERE NOT EXISTS.

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, 'jobs.assign', tp.granted
FROM team_privileges tp
WHERE tp.capability = 'jobs.edit_own'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = 'jobs.assign'
	);
