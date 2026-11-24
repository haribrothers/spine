CREATE TABLE "catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit" text NOT NULL,
	"category" text,
	"default_price_amount" bigint DEFAULT 0 NOT NULL,
	"default_price_currency" text NOT NULL,
	"default_tax_rate_percentage" real DEFAULT 0 NOT NULL,
	"income_account_id" uuid,
	"expense_account_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_income_account_id_accounts_id_fk" FOREIGN KEY ("income_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_expense_account_id_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_items_org_idx" ON "catalog_items" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "catalog_items_org_category_idx" ON "catalog_items" USING btree ("org_id","category");--> statement-breakpoint
CREATE INDEX "catalog_items_org_name_idx" ON "catalog_items" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "catalog_items_income_account_idx" ON "catalog_items" USING btree ("income_account_id");--> statement-breakpoint
CREATE INDEX "catalog_items_expense_account_idx" ON "catalog_items" USING btree ("expense_account_id");