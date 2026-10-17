-- US-AI-04, US-AI-06 (D-168, D-169): one row per AI request; never the prompt or the reply.
CREATE TYPE "public"."ai_feature" AS ENUM('read_document', 'draft_email', 'draft_quote_lines', 'bank_suggestions');--> statement-breakpoint
CREATE TYPE "public"."ai_outcome" AS ENUM('ok', 'error', 'timeout', 'budget', 'rate_limited');--> statement-breakpoint
CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text,
	"feature" "ai_feature" NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"outcome" "ai_outcome" NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_requests_org_created_idx" ON "ai_requests" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_requests_user_created_idx" ON "ai_requests" USING btree ("user_id","created_at");