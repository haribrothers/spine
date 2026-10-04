CREATE TABLE "ledger_integrity_checks" (
	"org_id" text PRIMARY KEY NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"difference" bigint NOT NULL,
	"last_balanced_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ledger_integrity_checks" ADD CONSTRAINT "ledger_integrity_checks_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;