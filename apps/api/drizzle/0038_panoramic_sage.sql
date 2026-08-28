ALTER TABLE "leads" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_created_by_idx" ON "leads" USING btree ("created_by_user_id");