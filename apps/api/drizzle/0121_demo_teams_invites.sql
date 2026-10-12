ALTER TABLE "invitation" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;