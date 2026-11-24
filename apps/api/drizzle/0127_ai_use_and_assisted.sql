-- US-AI-06 (D-166): records saved from fields AI filled in.
ALTER TABLE "quotes" ADD COLUMN "ai_assisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "ai_assisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD COLUMN "ai_assisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- US-AI-05 (D-167): "Use AI features", off for every existing Team.
INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), t.id, 'ai.use', false
FROM teams t
WHERE NOT EXISTS (
	SELECT 1 FROM team_privileges existing
	WHERE existing.team_id = t.id AND existing.capability = 'ai.use'
);
