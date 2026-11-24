CREATE TYPE "public"."gst_treatment" AS ENUM('registered', 'unregistered', 'consumer', 'overseas', 'sez');--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "state_code" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "gst_treatment" "gst_treatment";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "state_code" text;