CREATE TYPE "public"."email_kind" AS ENUM('quote', 'invoice', 'invoice_reminder', 'credit_note', 'receipt', 'refund', 'statement', 'notification', 'digest', 'invitation', 'password_reset', 'verification', 'data_export', 'test');--> statement-breakpoint
CREATE TYPE "public"."email_log_status" AS ENUM('queued', 'retrying', 'sending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text,
	"kind" "email_kind" NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"status" "email_log_status" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"last_error" text,
	"queue" text,
	"job_id" text,
	"payload" jsonb,
	"created_by_user_id" text,
	"cancelled_by_user_id" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_cancelled_by_user_id_user_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_log_org_queued_idx" ON "email_log" USING btree ("org_id","queued_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "email_log_org_status_idx" ON "email_log" USING btree ("org_id","status");