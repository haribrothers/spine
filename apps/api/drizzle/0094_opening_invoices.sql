ALTER TYPE "public"."invoice_type" ADD VALUE 'opening';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "is_opening" boolean DEFAULT false NOT NULL;