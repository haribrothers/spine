-- US-MCP-01 (D-257): Better Auth 1.7 keeps each signing key's algorithm and curve. Existing keys keep working (null = the 1.6 default, EdDSA/Ed25519).
ALTER TABLE "jwks" ADD COLUMN "alg" text;--> statement-breakpoint
ALTER TABLE "jwks" ADD COLUMN "crv" text;
