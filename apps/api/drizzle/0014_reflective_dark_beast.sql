CREATE TYPE "public"."quote_event_type" AS ENUM('viewed', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "quote_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"type" "quote_event_type" NOT NULL,
	"comment" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_public_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonce" text NOT NULL,
	"quote_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_public_tokens_nonce_unique" UNIQUE("nonce")
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "response_comment" text;--> statement-breakpoint
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_public_tokens" ADD CONSTRAINT "quote_public_tokens_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_public_tokens" ADD CONSTRAINT "quote_public_tokens_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_events_quote_idx" ON "quote_events" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_events_org_idx" ON "quote_events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "quote_events_type_idx" ON "quote_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "quote_public_tokens_nonce_idx" ON "quote_public_tokens" USING btree ("nonce");--> statement-breakpoint
CREATE INDEX "quote_public_tokens_quote_idx" ON "quote_public_tokens" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_public_tokens_org_idx" ON "quote_public_tokens" USING btree ("org_id");