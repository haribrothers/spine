-- US-MCP-08 (D-258): one row per agent tool call (tool, record, outcome, duration; never arguments or results).
CREATE TYPE "public"."agent_request_outcome" AS ENUM('ok', 'refused', 'error', 'rate_limited');--> statement-breakpoint
CREATE TABLE "agent_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text,
	"connection_id" uuid,
	"tool" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"outcome" "agent_request_outcome" NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_connection_id_agent_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."agent_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_requests_org_created_idx" ON "agent_requests" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_requests_connection_idx" ON "agent_requests" USING btree ("connection_id");
