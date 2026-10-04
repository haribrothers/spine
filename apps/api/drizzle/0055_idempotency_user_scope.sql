ALTER TABLE "idempotency_keys" DROP CONSTRAINT "idempotency_keys_org_endpoint_key_unique";--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_org_user_endpoint_key_unique" UNIQUE("org_id","user_id","endpoint","key");