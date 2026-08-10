CREATE TYPE "public"."expense_paid_by" AS ENUM('company', 'employee');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."vendor_bill_line_type" AS ENUM('item', 'heading', 'text');--> statement-breakpoint
CREATE TYPE "public"."vendor_bill_status" AS ENUM('draft', 'recorded', 'void');--> statement-breakpoint
CREATE TYPE "public"."vendor_payment_method" AS ENUM('cash', 'bank_transfer', 'cheque', 'card', 'upi', 'other');--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"account_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"number" text,
	"category_id" uuid NOT NULL,
	"job_id" uuid,
	"date" date NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"tax_rate_id" uuid,
	"description" text,
	"paid_by" "expense_paid_by" DEFAULT 'company' NOT NULL,
	"receipt_file_id" uuid,
	"status" "expense_status" DEFAULT 'submitted' NOT NULL,
	"submitted_by_user_id" text,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone,
	"rejected_by_user_id" text,
	"rejected_at" timestamp with time zone,
	"review_comment" text,
	"is_billable" boolean DEFAULT false NOT NULL,
	"billed_on_invoice_line_id" uuid,
	"journal_entry_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_bill_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"type" "vendor_bill_line_type" DEFAULT 'item' NOT NULL,
	"catalog_item_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"quantity" real DEFAULT 0 NOT NULL,
	"unit_price_amount" bigint DEFAULT 0 NOT NULL,
	"unit_price_currency" text NOT NULL,
	"account_id" uuid,
	"tax_rate_percentage" real DEFAULT 0 NOT NULL,
	"tax_rate_id" uuid,
	"tax_group_id" uuid,
	"is_tax_inclusive" boolean DEFAULT false NOT NULL,
	"line_subtotal_amount" bigint DEFAULT 0 NOT NULL,
	"line_tax_amount" bigint DEFAULT 0 NOT NULL,
	"line_total_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"job_id" uuid,
	"status" "vendor_bill_status" DEFAULT 'draft' NOT NULL,
	"bill_number" text NOT NULL,
	"date" date NOT NULL,
	"due_date" date,
	"currency" text NOT NULL,
	"subtotal_amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"amount_paid" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by_user_id" text,
	"recorded_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" text,
	"void_reason" text,
	"journal_entry_id" uuid,
	"void_journal_entry_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"vendor_payment_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_payment_allocations_amount_positive" CHECK ("vendor_payment_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"number" text,
	"date" date NOT NULL,
	"method" "vendor_payment_method" NOT NULL,
	"reference" text,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"allocated_amount" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by_user_id" text,
	"journal_entry_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_payments_amount_positive" CHECK ("vendor_payments"."amount" > 0),
	CONSTRAINT "vendor_payments_allocated_not_negative" CHECK ("vendor_payments"."allocated_amount" >= 0),
	CONSTRAINT "vendor_payments_allocated_not_over_amount" CHECK ("vendor_payments"."allocated_amount" <= "vendor_payments"."amount")
);
--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_file_id_files_id_fk" FOREIGN KEY ("receipt_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_rejected_by_user_id_user_id_fk" FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_billed_on_invoice_line_id_invoice_lines_id_fk" FOREIGN KEY ("billed_on_invoice_line_id") REFERENCES "public"."invoice_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_bill_id_vendor_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."vendor_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_tax_group_id_tax_groups_id_fk" FOREIGN KEY ("tax_group_id") REFERENCES "public"."tax_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_voided_by_user_id_user_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_void_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("void_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_vendor_payment_id_vendor_payments_id_fk" FOREIGN KEY ("vendor_payment_id") REFERENCES "public"."vendor_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_bill_id_vendor_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."vendor_bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_categories_org_idx" ON "expense_categories" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "expense_categories_account_idx" ON "expense_categories" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "expenses_org_idx" ON "expenses" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "expenses_org_status_idx" ON "expenses" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "expenses_job_idx" ON "expenses" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "expenses_submitted_by_idx" ON "expenses" USING btree ("submitted_by_user_id");--> statement-breakpoint
CREATE INDEX "expenses_org_demo_idx" ON "expenses" USING btree ("org_id","is_demo");--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_bill_idx" ON "vendor_bill_lines" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_catalog_item_idx" ON "vendor_bill_lines" USING btree ("catalog_item_id");--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_account_idx" ON "vendor_bill_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "vendor_bills_org_idx" ON "vendor_bills" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vendor_bills_org_status_idx" ON "vendor_bills" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "vendor_bills_contact_idx" ON "vendor_bills" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "vendor_bills_job_idx" ON "vendor_bills" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "vendor_bills_org_demo_idx" ON "vendor_bills" USING btree ("org_id","is_demo");--> statement-breakpoint
CREATE INDEX "vendor_payment_allocations_payment_idx" ON "vendor_payment_allocations" USING btree ("vendor_payment_id");--> statement-breakpoint
CREATE INDEX "vendor_payment_allocations_bill_idx" ON "vendor_payment_allocations" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "vendor_payment_allocations_org_idx" ON "vendor_payment_allocations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vendor_payments_org_idx" ON "vendor_payments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vendor_payments_org_demo_idx" ON "vendor_payments" USING btree ("org_id","is_demo");--> statement-breakpoint
CREATE INDEX "vendor_payments_contact_idx" ON "vendor_payments" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "vendor_payments_org_number_idx" ON "vendor_payments" USING btree ("org_id","number");