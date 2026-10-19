-- US-AI-14 (D-173): who suggested a match, and AI's last suggestions on a reconciliation.
CREATE TYPE "public"."match_suggested_by" AS ENUM('rules', 'ai', 'person');--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD COLUMN "ai_suggestions" jsonb;--> statement-breakpoint
ALTER TABLE "bank_statement_line_matches" ADD COLUMN "suggested_by" "match_suggested_by" DEFAULT 'person' NOT NULL;