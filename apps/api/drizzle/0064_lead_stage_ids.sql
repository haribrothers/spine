DROP INDEX "leads_org_stage_idx";--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "stage_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "leads_org_stage_idx" ON "leads" USING btree ("org_id","stage_id");--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "stage";--> statement-breakpoint
DROP TYPE "public"."lead_stage";