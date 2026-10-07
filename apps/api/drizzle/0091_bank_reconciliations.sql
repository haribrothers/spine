CREATE TYPE "public"."reconciliation_status" AS ENUM('in_progress', 'finished', 'undone');--> statement-breakpoint
CREATE TABLE "bank_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"money_account_id" uuid NOT NULL,
	"statement_end_date" date NOT NULL,
	"statement_closing_balance" bigint NOT NULL,
	"status" "reconciliation_status" DEFAULT 'in_progress' NOT NULL,
	"opening_balance" bigint,
	"brought_forward_before" date,
	"started_by_user_id" text,
	"finished_by_user_id" text,
	"finished_at" timestamp with time zone,
	"undone_by_user_id" text,
	"undone_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statement_line_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_line_id" uuid NOT NULL,
	"journal_line_id" uuid NOT NULL,
	"reconciliation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD COLUMN "reconciliation_id" uuid;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_money_account_id_money_accounts_id_fk" FOREIGN KEY ("money_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_started_by_user_id_user_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_finished_by_user_id_user_id_fk" FOREIGN KEY ("finished_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_undone_by_user_id_user_id_fk" FOREIGN KEY ("undone_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_line_matches" ADD CONSTRAINT "bank_statement_line_matches_statement_line_id_bank_statement_lines_id_fk" FOREIGN KEY ("statement_line_id") REFERENCES "public"."bank_statement_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_line_matches" ADD CONSTRAINT "bank_statement_line_matches_journal_line_id_journal_lines_id_fk" FOREIGN KEY ("journal_line_id") REFERENCES "public"."journal_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_line_matches" ADD CONSTRAINT "bank_statement_line_matches_reconciliation_id_bank_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."bank_reconciliations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_reconciliations_one_in_progress_uidx" ON "bank_reconciliations" USING btree ("money_account_id") WHERE "bank_reconciliations"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "bank_reconciliations_account_idx" ON "bank_reconciliations" USING btree ("money_account_id","statement_end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_statement_line_matches_journal_line_uidx" ON "bank_statement_line_matches" USING btree ("journal_line_id");--> statement-breakpoint
CREATE INDEX "bank_statement_line_matches_line_idx" ON "bank_statement_line_matches" USING btree ("statement_line_id");--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_reconciliation_id_bank_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."bank_reconciliations"("id") ON DELETE no action ON UPDATE no action;