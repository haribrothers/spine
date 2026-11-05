/**
 * US-SITE-10 — the settings the API's modules read when they load. The
 * export never connects to anything, so placeholders do; imported first.
 */
process.env.DATABASE_URL ??= "postgres://spine:spine@localhost:5432/spine";
process.env.AUTH_SECRET ??= "openapi-export-only-not-a-secret";
process.env.APP_URL ??= "http://localhost:3000";
process.env.UPDATE_CHECK = "off";
