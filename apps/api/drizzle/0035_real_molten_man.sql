ALTER TABLE "contacts" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_created_by_idx" ON "contacts" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "catalog_items_created_by_idx" ON "catalog_items" USING btree ("created_by_user_id");