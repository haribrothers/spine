CREATE TYPE "public"."meeting_occurrence_exception_status" AS ENUM('modified', 'cancelled');--> statement-breakpoint
CREATE TABLE "meeting_occurrence_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"occurrence_date" timestamp with time zone NOT NULL,
	"status" "meeting_occurrence_exception_status" NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"title" text,
	"location" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_occurrence_exceptions_meeting_date_unique" UNIQUE("meeting_id","occurrence_date")
);
--> statement-breakpoint
ALTER TABLE "meeting_occurrence_exceptions" ADD CONSTRAINT "meeting_occurrence_exceptions_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_occurrence_exceptions_meeting_idx" ON "meeting_occurrence_exceptions" USING btree ("meeting_id");