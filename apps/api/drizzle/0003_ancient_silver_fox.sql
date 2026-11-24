ALTER TABLE "member" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "deactivated_at" timestamp;