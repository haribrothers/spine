ALTER TABLE "user" ADD COLUMN "favourite_reports" jsonb;--> statement-breakpoint
-- US-RPT-23 (D-136): "View financial statements" exists for every Team, off.
INSERT INTO "team_privileges" ("team_id", "capability", "granted")
SELECT t."id", 'reports.view_financial_statements', false
FROM "teams" t
WHERE NOT EXISTS (SELECT 1 FROM "team_privileges" p WHERE p."team_id" = t."id" AND p."capability" = 'reports.view_financial_statements');
