ALTER TABLE "expense_categories" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD COLUMN "default_tax_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_default_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("default_tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- US-PUR-47 (D-228): names are trimmed, then a business's duplicate names (ignoring case) become "<name> (2)", "(3)"… — the oldest keeps its name.
UPDATE "expense_categories" SET "name" = btrim("name") WHERE "name" <> btrim("name");--> statement-breakpoint
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "org_id", lower("name") ORDER BY "created_at", "id") AS n
  FROM "expense_categories"
)
UPDATE "expense_categories" c SET "name" = c."name" || ' (' || ranked.n || ')'
FROM ranked WHERE ranked."id" = c."id" AND ranked.n > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_org_name_uq" ON "expense_categories" USING btree ("org_id",lower(btrim("name")));--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_description_len" CHECK ("expense_categories"."description" is null or char_length("expense_categories"."description") <= 120);