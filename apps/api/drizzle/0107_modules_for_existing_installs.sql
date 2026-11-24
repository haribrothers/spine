-- US-SET-23 / US-ONB-14 (D-154): every module is on for organisations that existed before modules,
-- saved now so a later industry-template change never switches one off for them.
INSERT INTO "settings" ("org_id", "key", "value")
SELECT "id", 'modules', '{"leadsMeetings": true, "jobsField": true, "approvals": true, "recurring": true}'::jsonb
FROM "organization"
ON CONFLICT ("org_id", "key") DO NOTHING;
