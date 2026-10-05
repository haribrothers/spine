CREATE TYPE "public"."catalog_bundle_line_type" AS ENUM('item', 'heading', 'text');--> statement-breakpoint
CREATE TABLE "catalog_bundle_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"type" "catalog_bundle_line_type" DEFAULT 'item' NOT NULL,
	"catalog_item_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"quantity" numeric(18, 4) DEFAULT 0 NOT NULL,
	"unit_price_amount" bigint DEFAULT 0 NOT NULL,
	"discount_percentage" numeric(18, 4) DEFAULT 0 NOT NULL,
	"tax_rate_percentage" numeric(18, 4) DEFAULT 0 NOT NULL,
	"tax_rate_id" uuid,
	"tax_group_id" uuid,
	"is_tax_inclusive" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"currency" text NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_bundle_lines" ADD CONSTRAINT "catalog_bundle_lines_bundle_id_catalog_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."catalog_bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_bundle_lines" ADD CONSTRAINT "catalog_bundle_lines_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_bundle_lines" ADD CONSTRAINT "catalog_bundle_lines_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_bundle_lines" ADD CONSTRAINT "catalog_bundle_lines_tax_group_id_tax_groups_id_fk" FOREIGN KEY ("tax_group_id") REFERENCES "public"."tax_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_bundles" ADD CONSTRAINT "catalog_bundles_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_bundles" ADD CONSTRAINT "catalog_bundles_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_bundle_lines_bundle_idx" ON "catalog_bundle_lines" USING btree ("bundle_id","sort_order");--> statement-breakpoint
CREATE INDEX "catalog_bundles_org_idx" ON "catalog_bundles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "catalog_bundles_created_by_idx" ON "catalog_bundles" USING btree ("created_by_user_id");