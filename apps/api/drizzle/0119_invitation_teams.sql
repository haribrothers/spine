CREATE TABLE "invitation_teams" (
	"invitation_id" text NOT NULL,
	"team_id" uuid NOT NULL,
	CONSTRAINT "invitation_teams_invitation_id_team_id_pk" PRIMARY KEY("invitation_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "invitation_teams" ADD CONSTRAINT "invitation_teams_invitation_id_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_teams" ADD CONSTRAINT "invitation_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitation_teams_team_id_idx" ON "invitation_teams" USING btree ("team_id");