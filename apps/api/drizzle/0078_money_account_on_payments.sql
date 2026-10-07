ALTER TABLE "user" ADD COLUMN "last_money_accounts" jsonb;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "money_account_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "money_account_id" uuid;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN "money_account_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_money_account_id_money_accounts_id_fk" FOREIGN KEY ("money_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_money_account_id_money_accounts_id_fk" FOREIGN KEY ("money_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_money_account_id_money_accounts_id_fk" FOREIGN KEY ("money_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- US-BANK-03: backfill each posted payment, vendor payment and expense from
-- the money account its journal entry actually used, then anything not yet
-- posted (submitted expenses) from the organisation's default. Safe to re-run.
UPDATE "payments" p SET "money_account_id" = (
	SELECT m."id" FROM "journal_lines" jl JOIN "money_accounts" m ON m."account_id" = jl."account_id"
	WHERE jl."entry_id" = p."journal_entry_id" LIMIT 1
) WHERE p."money_account_id" IS NULL AND p."journal_entry_id" IS NOT NULL;--> statement-breakpoint
UPDATE "vendor_payments" v SET "money_account_id" = (
	SELECT m."id" FROM "journal_lines" jl JOIN "money_accounts" m ON m."account_id" = jl."account_id"
	WHERE jl."entry_id" = v."journal_entry_id" LIMIT 1
) WHERE v."money_account_id" IS NULL AND v."journal_entry_id" IS NOT NULL;--> statement-breakpoint
UPDATE "expenses" e SET "money_account_id" = (
	SELECT m."id" FROM "journal_lines" jl JOIN "money_accounts" m ON m."account_id" = jl."account_id"
	WHERE jl."entry_id" = e."journal_entry_id" LIMIT 1
) WHERE e."money_account_id" IS NULL AND e."journal_entry_id" IS NOT NULL;--> statement-breakpoint
UPDATE "payments" p SET "money_account_id" = (SELECT m."id" FROM "money_accounts" m WHERE m."org_id" = p."org_id" AND m."is_default") WHERE p."money_account_id" IS NULL;--> statement-breakpoint
UPDATE "vendor_payments" v SET "money_account_id" = (SELECT m."id" FROM "money_accounts" m WHERE m."org_id" = v."org_id" AND m."is_default") WHERE v."money_account_id" IS NULL;--> statement-breakpoint
UPDATE "expenses" e SET "money_account_id" = (SELECT m."id" FROM "money_accounts" m WHERE m."org_id" = e."org_id" AND m."is_default") WHERE e."money_account_id" IS NULL;
