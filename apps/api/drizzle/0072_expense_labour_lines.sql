CREATE TABLE "expense_labour_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"expense_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"trade" text NOT NULL,
	"headcount" integer NOT NULL,
	"day_rate_amount" bigint NOT NULL,
	"line_amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "entry_mode" text DEFAULT 'amount' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_labour_lines" ADD CONSTRAINT "expense_labour_lines_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_labour_lines" ADD CONSTRAINT "expense_labour_lines_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_labour_lines_expense_idx" ON "expense_labour_lines" USING btree ("expense_id","sort_order");--> statement-breakpoint
CREATE INDEX "expense_labour_lines_org_trade_idx" ON "expense_labour_lines" USING btree ("org_id","trade");