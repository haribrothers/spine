-- Hand-authored (not drizzle-kit generated) — no schema change needed.
-- Splits the single `dashboard.view` capability into four independent
-- capabilities, one per report: `reports.view_dashboard_summary`,
-- `reports.view_receivables`, `reports.view_payables`,
-- `reports.view_job_profitability`. An Owner can now grant a Team
-- visibility into one report (e.g. receivables) without the others (e.g.
-- payables), rather than one blanket toggle covering all four.
--
-- `ledger.view` is unaffected by this migration — it existed in the
-- capability list before this change but gated no route (dead weight);
-- it now gates `GET /reports/account-drilldown` for Staff (alongside
-- Owner's existing unconditional access), but since no team ever had a
-- reason to grant it before (it did nothing), there is no meaningful
-- prior grant to backfill — it keeps its existing default of `false` for
-- every team, same as before this migration.
--
--   dashboard.view -> reports.view_dashboard_summary,
--                      reports.view_receivables,
--                      reports.view_payables,
--                      reports.view_job_profitability
--
-- Safe to re-run: guarded by WHERE NOT EXISTS per capability.

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, cap.capability, tp.granted
FROM team_privileges tp
CROSS JOIN (VALUES
	('reports.view_dashboard_summary'),
	('reports.view_receivables'),
	('reports.view_payables'),
	('reports.view_job_profitability')
) AS cap(capability)
WHERE tp.capability = 'dashboard.view'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = cap.capability
	);

DELETE FROM team_privileges WHERE capability = 'dashboard.view';
