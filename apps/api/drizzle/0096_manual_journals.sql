CREATE TYPE "public"."manual_journal_status" AS ENUM('posted', 'reversed');--> statement-breakpoint
CREATE TABLE "manual_journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"account_id" uuid NOT NULL,
	"description" text,
	"debit" bigint DEFAULT 0 NOT NULL,
	"credit" bigint DEFAULT 0 NOT NULL,
	"job_id" uuid,
	CONSTRAINT "manual_journal_lines_one_sided" CHECK ("manual_journal_lines"."debit" >= 0 AND "manual_journal_lines"."credit" >= 0 AND ("manual_journal_lines"."debit" = 0) <> ("manual_journal_lines"."credit" = 0))
);
--> statement-breakpoint
CREATE TABLE "manual_journals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"number" text NOT NULL,
	"date" date NOT NULL,
	"reason" text NOT NULL,
	"status" "manual_journal_status" DEFAULT 'posted' NOT NULL,
	"entry_id" uuid NOT NULL,
	"reversal_entry_id" uuid,
	"reversal_date" date,
	"reversal_reason" text,
	"reversed_at" timestamp with time zone,
	"reversed_by_user_id" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manual_journal_lines" ADD CONSTRAINT "manual_journal_lines_journal_id_manual_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."manual_journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_journal_lines" ADD CONSTRAINT "manual_journal_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_journal_lines" ADD CONSTRAINT "manual_journal_lines_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_journals" ADD CONSTRAINT "manual_journals_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_journals" ADD CONSTRAINT "manual_journals_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_journals" ADD CONSTRAINT "manual_journals_reversal_entry_id_journal_entries_id_fk" FOREIGN KEY ("reversal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_journals" ADD CONSTRAINT "manual_journals_reversed_by_user_id_user_id_fk" FOREIGN KEY ("reversed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_journals" ADD CONSTRAINT "manual_journals_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manual_journal_lines_journal_idx" ON "manual_journal_lines" USING btree ("journal_id");--> statement-breakpoint
CREATE INDEX "manual_journals_org_date_idx" ON "manual_journals" USING btree ("org_id","date");