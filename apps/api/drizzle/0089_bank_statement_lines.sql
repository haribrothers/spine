CREATE TYPE "public"."statement_line_status" AS ENUM('unmatched', 'matched', 'excluded');--> statement-breakpoint
CREATE TABLE "bank_statement_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"money_account_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"imported_count" bigint NOT NULL,
	"skipped_count" bigint NOT NULL,
	"failed_rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"imported_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"money_account_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"reference" text,
	"amount" bigint NOT NULL,
	"running_balance" bigint,
	"dedupe_key" text NOT NULL,
	"status" "statement_line_status" DEFAULT 'unmatched' NOT NULL,
	"exclude_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_money_account_id_money_accounts_id_fk" FOREIGN KEY ("money_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_imported_by_user_id_user_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_money_account_id_money_accounts_id_fk" FOREIGN KEY ("money_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_import_id_bank_statement_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."bank_statement_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_statement_imports_account_idx" ON "bank_statement_imports" USING btree ("money_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_statement_lines_dedupe_uidx" ON "bank_statement_lines" USING btree ("money_account_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "bank_statement_lines_account_date_idx" ON "bank_statement_lines" USING btree ("money_account_id","date");