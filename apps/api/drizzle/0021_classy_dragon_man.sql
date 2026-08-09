CREATE TABLE "team_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_memberships_team_member_unique" UNIQUE("team_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "team_privileges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"capability" text NOT NULL,
	"granted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "team_privileges_team_capability_unique" UNIQUE("team_id","capability")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_org_name_unique" UNIQUE("org_id","name")
);
--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "is_primary_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_privileges" ADD CONSTRAINT "team_privileges_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_memberships_team_id_idx" ON "team_memberships" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_memberships_member_id_idx" ON "team_memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "team_privileges_team_id_idx" ON "team_privileges" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "teams_org_id_idx" ON "teams" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_primary_owner_uidx" ON "member" USING btree ("organization_id") WHERE "member"."is_primary_owner" = true;