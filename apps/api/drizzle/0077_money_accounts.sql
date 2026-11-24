CREATE TYPE "public"."money_account_kind" AS ENUM('bank', 'cash', 'card');--> statement-breakpoint
CREATE TABLE "money_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" "money_account_kind" NOT NULL,
	"name" text NOT NULL,
	"bank_name" text,
	"last4" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"statement_mapping" jsonb,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "money_accounts" ADD CONSTRAINT "money_accounts_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_accounts" ADD CONSTRAINT "money_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "money_accounts_account_uidx" ON "money_accounts" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "money_accounts_default_uidx" ON "money_accounts" USING btree ("org_id") WHERE "money_accounts"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "money_accounts_active_name_uidx" ON "money_accounts" USING btree ("org_id",lower("name")) WHERE "money_accounts"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "money_accounts_org_idx" ON "money_accounts" USING btree ("org_id");--> statement-breakpoint
-- US-BANK-01 (D-140): 1000 Cash in Hand and 1010 Bank Account become money
-- accounts in every existing organisation, 1010 the default. Safe to re-run.
INSERT INTO "money_accounts" ("org_id", "account_id", "kind", "name", "is_default")
SELECT a."org_id", a."id", CASE WHEN a."code" = '1000' THEN 'cash'::money_account_kind ELSE 'bank'::money_account_kind END, a."name", a."code" = '1010'
FROM "accounts" a
WHERE a."code" IN ('1000', '1010')
	AND NOT EXISTS (SELECT 1 FROM "money_accounts" m WHERE m."account_id" = a."id");--> statement-breakpoint
-- An organisation without 1010 still gets one default: its lowest-coded money account.
UPDATE "money_accounts" m SET "is_default" = true
WHERE m."id" IN (
	SELECT DISTINCT ON (m2."org_id") m2."id"
	FROM "money_accounts" m2 JOIN "accounts" a ON a."id" = m2."account_id"
	WHERE NOT EXISTS (SELECT 1 FROM "money_accounts" d WHERE d."org_id" = m2."org_id" AND d."is_default")
	ORDER BY m2."org_id", a."code"
);--> statement-breakpoint
-- US-BANK-12: banking capabilities, off for every existing Team (all ✗ by default).
INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), t.id, cap.capability, false
FROM teams t
CROSS JOIN (VALUES ('banking.view'), ('banking.record'), ('banking.reconcile')) AS cap(capability)
WHERE NOT EXISTS (
	SELECT 1 FROM team_privileges existing
	WHERE existing.team_id = t.id AND existing.capability = cap.capability
);
