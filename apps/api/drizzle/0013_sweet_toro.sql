CREATE TYPE "public"."quote_email_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "email_status" "quote_email_status";--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "email_error" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "email_sent_at" timestamp with time zone;