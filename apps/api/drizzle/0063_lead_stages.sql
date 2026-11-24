CREATE TYPE "public"."lead_stage_kind" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "lead_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "lead_stage_kind" DEFAULT 'open' NOT NULL,
	"sort_order" integer NOT NULL,
	"color" text DEFAULT 'slate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "stage_id" uuid;--> statement-breakpoint
ALTER TABLE "lead_stages" ADD CONSTRAINT "lead_stages_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_stages_org_idx" ON "lead_stages" USING btree ("org_id","sort_order");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_id_lead_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."lead_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- US-CRM-19: every existing organisation starts with the five stages the
-- fixed enum had, in the same order; LeadStagesService seeds the same rows
-- (DEFAULT_LEAD_STAGES in @spine/shared) for organisations created later.
INSERT INTO "lead_stages" ("org_id", "name", "kind", "sort_order", "color")
SELECT o."id", s."name", s."kind"::"lead_stage_kind", s."sort_order", s."color"
FROM "organization" o
CROSS JOIN (VALUES
	('New', 'open', 0, 'slate'),
	('Qualified', 'open', 1, 'blue'),
	('Proposal', 'open', 2, 'amber'),
	('Won', 'won', 3, 'green'),
	('Lost', 'lost', 4, 'red')
) AS s("name", "kind", "sort_order", "color");--> statement-breakpoint
-- Each lead moves to its organisation's stage at the same position.
UPDATE "leads" l
SET "stage_id" = ls."id"
FROM "lead_stages" ls
WHERE ls."org_id" = l."org_id"
	AND ls."sort_order" = CASE l."stage"
		WHEN 'new' THEN 0
		WHEN 'qualified' THEN 1
		WHEN 'proposal' THEN 2
		WHEN 'won' THEN 3
		WHEN 'lost' THEN 4
	END;
