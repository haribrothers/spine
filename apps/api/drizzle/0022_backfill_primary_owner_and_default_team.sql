-- Hand-authored (not drizzle-kit generated) — backfills data for
-- organisations that predate the Teams/Primary Owner feature added in
-- 0021_classy_dragon_man.sql. Safe to re-run: every insert/update is guarded
-- by WHERE NOT EXISTS / a deterministic ROW_NUMBER pick, so running this
-- twice is a no-op the second time.

-- 1. Mark each org's earliest-created active owner as its Primary Owner.
-- Ties (identical created_at, e.g. from a bulk seed script) are broken by
-- member.id for determinism.
WITH ranked_owners AS (
	SELECT
		id,
		organization_id,
		ROW_NUMBER() OVER (
			PARTITION BY organization_id
			ORDER BY created_at ASC, id ASC
		) AS rn
	FROM member
	WHERE role = 'owner' AND is_active = true
)
UPDATE member
SET is_primary_owner = true
FROM ranked_owners
WHERE member.id = ranked_owners.id AND ranked_owners.rn = 1;
--> statement-breakpoint

-- 2. Seed a default "General Staff" team for every org that doesn't already
-- have one.
INSERT INTO teams (id, org_id, name, is_default, created_at, updated_at)
SELECT gen_random_uuid(), o.id, 'General Staff', true, now(), now()
FROM organization o
WHERE NOT EXISTS (
	SELECT 1 FROM teams t WHERE t.org_id = o.id AND t.is_default = true
);
--> statement-breakpoint

-- 3. Seed that default team's privileges. These literals MUST match
-- DEFAULT_TEAM_GRANTS in packages/shared/src/schemas/permissions.ts exactly
-- — SQL can't import the TS const, so any future change to that file's
-- defaults needs a matching follow-up migration, not an edit here (this
-- migration only backfills existing orgs once; new orgs get their default
-- team from the seedDefaultTeam() code path, which does read the TS const).
INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), t.id, cap.capability, cap.granted
FROM teams t
CROSS JOIN (VALUES
	('dashboard.view', true),
	('contacts.manage', true),
	('quotes.manage', true),
	('quotes.approve_discount', false),
	('invoices.manage', true),
	('expenses.submit', true),
	('expenses.approve', true),
	('jobs.update_milestones', true),
	('ledger.view', false)
) AS cap(capability, granted)
WHERE t.is_default = true
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges tp WHERE tp.team_id = t.id AND tp.capability = cap.capability
	);
--> statement-breakpoint

-- 4. Put every existing active Staff member into their org's default team,
-- so nobody silently loses access the moment this feature ships.
INSERT INTO team_memberships (id, team_id, member_id, created_at)
SELECT gen_random_uuid(), t.id, m.id, now()
FROM member m
JOIN teams t ON t.org_id = m.organization_id AND t.is_default = true
WHERE m.role = 'staff'
	AND NOT EXISTS (
		SELECT 1 FROM team_memberships tm WHERE tm.team_id = t.id AND tm.member_id = m.id
	);
