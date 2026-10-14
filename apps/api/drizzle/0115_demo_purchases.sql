ALTER TABLE "recurring_bills" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_credits" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_refunds" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;
