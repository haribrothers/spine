CREATE TYPE "public"."quote_acceptance_method" AS ENUM('public_link', 'in_person');--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "acceptance_method" "quote_acceptance_method";--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_by_user_id" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;