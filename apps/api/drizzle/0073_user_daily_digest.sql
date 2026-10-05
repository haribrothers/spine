ALTER TABLE "user" ADD COLUMN "digest_enabled" boolean;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "digest_time" time DEFAULT '07:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "digest_days" text DEFAULT 'weekdays' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "digest_last_sent_on" date;