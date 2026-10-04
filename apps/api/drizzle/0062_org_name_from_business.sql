-- US-TEAM-15: the organisation is named after the business. Copy each
-- business profile's name into organization.name where they differ (an
-- install whose organisation is still "<Owner>'s Organisation").
UPDATE organization o
SET name = btrim(s.value ->> 'name')
FROM settings s
WHERE s.org_id = o.id
  AND s.key = 'business_profile'
  AND nullif(btrim(s.value ->> 'name'), '') IS NOT NULL
  AND o.name IS DISTINCT FROM btrim(s.value ->> 'name');
