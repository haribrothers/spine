CREATE TYPE "public"."meeting_attendee_status" AS ENUM('invited', 'accepted', 'declined', 'tentative');--> statement-breakpoint
CREATE TYPE "public"."meeting_visibility" AS ENUM('private', 'org');--> statement-breakpoint
CREATE TABLE "meeting_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"user_id" text,
	"status" "meeting_attendee_status" DEFAULT 'invited' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"reminded_at" timestamp with time zone,
	"reminded_for_occurrence_start" timestamp with time zone,
	CONSTRAINT "meeting_attendees_meeting_user_unique" UNIQUE("meeting_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "meeting_reminder_lead_minutes" integer;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "visibility" "meeting_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_attendees_meeting_idx" ON "meeting_attendees" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meeting_attendees_user_idx" ON "meeting_attendees" USING btree ("user_id");