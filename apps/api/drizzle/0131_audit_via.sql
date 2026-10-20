-- US-MCP-07 (D-258): which agent, if any, a change came through ("via Claude").
ALTER TABLE "audit_log" ADD COLUMN "via" text;
