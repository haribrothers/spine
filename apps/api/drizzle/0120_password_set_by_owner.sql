ALTER TYPE "public"."email_kind" ADD VALUE 'password_set_by_owner' BEFORE 'verification';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;