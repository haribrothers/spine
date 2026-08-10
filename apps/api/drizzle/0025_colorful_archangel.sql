CREATE TYPE "public"."job_status" AS ENUM('active', 'on_hold', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."milestone_amount_type" AS ENUM('fixed', 'percent');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('pending', 'completed', 'invoiced');--> statement-breakpoint
CREATE TABLE "job_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"body" text NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"milestone_id" uuid,
	"file_id" uuid NOT NULL,
	"caption" text,
	"uploaded_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_variation_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"applied_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"source_quote_id" uuid,
	"name" text NOT NULL,
	"site_address" text,
	"status" "job_status" DEFAULT 'active' NOT NULL,
	"start_date" date,
	"end_date" date,
	"currency" text NOT NULL,
	"contract_value_amount" bigint DEFAULT 0 NOT NULL,
	"retention_pct" real DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by_user_id" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"amount_type" "milestone_amount_type" DEFAULT 'percent' NOT NULL,
	"amount" real DEFAULT 0 NOT NULL,
	"resolved_amount" bigint DEFAULT 0 NOT NULL,
	"status" "milestone_status" DEFAULT 'pending' NOT NULL,
	"due_date" date,
	"completed_by_user_id" text,
	"completed_at" timestamp with time zone,
	"completion_notes" text,
	"invoiced_invoice_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variation_orders" ADD CONSTRAINT "job_variation_orders_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variation_orders" ADD CONSTRAINT "job_variation_orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variation_orders" ADD CONSTRAINT "job_variation_orders_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variation_orders" ADD CONSTRAINT "job_variation_orders_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_quote_id_quotes_id_fk" FOREIGN KEY ("source_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_completed_by_user_id_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_notes_job_idx" ON "job_notes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_notes_org_idx" ON "job_notes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "job_photos_job_idx" ON "job_photos" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_photos_org_idx" ON "job_photos" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "job_photos_milestone_idx" ON "job_photos" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "job_variation_orders_job_idx" ON "job_variation_orders" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_variation_orders_quote_idx" ON "job_variation_orders" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "job_variation_orders_org_idx" ON "job_variation_orders" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "jobs_org_idx" ON "jobs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "jobs_org_status_idx" ON "jobs" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "jobs_org_demo_idx" ON "jobs" USING btree ("org_id","is_demo");--> statement-breakpoint
CREATE INDEX "jobs_contact_idx" ON "jobs" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "jobs_source_quote_idx" ON "jobs" USING btree ("source_quote_id");--> statement-breakpoint
CREATE INDEX "milestones_job_idx" ON "milestones" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "milestones_org_idx" ON "milestones" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "milestones_org_status_idx" ON "milestones" USING btree ("org_id","status");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_job_idx" ON "invoices" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "invoices_milestone_idx" ON "invoices" USING btree ("milestone_id");