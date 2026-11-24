-- US-JOB-23 (D-090, D-122): rename jobs still called "Job for <quote number>"
-- by the new rule (first item line — customer, " (n)" for repeat
-- conversions of the same quote), and record each rename in the job's
-- history. Jobs someone already renamed are left alone.
WITH ranked AS (
  SELECT
    j.id,
    j.org_id,
    j.contact_id,
    j.name AS old_name,
    q.number AS quote_number,
    row_number() OVER (PARTITION BY j.source_quote_id ORDER BY j.created_at, j.id) AS conversion,
    (
      SELECT ql.name
      FROM quote_lines ql
      WHERE ql.quote_id = j.source_quote_id AND ql.type = 'item'
      ORDER BY ql.sort_order
      LIMIT 1
    ) AS item_name,
    c.name AS customer_name
  FROM jobs j
  JOIN quotes q ON q.id = j.source_quote_id
  LEFT JOIN contacts c ON c.id = j.contact_id
  WHERE j.source_quote_id IS NOT NULL
),
named AS (
  SELECT
    id,
    org_id,
    contact_id,
    old_name,
    CASE
      WHEN nullif(btrim(item_name), '') IS NOT NULL AND nullif(btrim(customer_name), '') IS NOT NULL THEN btrim(item_name) || ' — ' || btrim(customer_name)
      WHEN nullif(btrim(item_name), '') IS NOT NULL THEN btrim(item_name)
      WHEN nullif(btrim(customer_name), '') IS NOT NULL THEN 'Work for ' || btrim(customer_name)
      ELSE 'New job'
    END || CASE WHEN conversion > 1 THEN ' (' || conversion || ')' ELSE '' END AS new_name
  FROM ranked
  WHERE quote_number IS NOT NULL AND old_name = 'Job for ' || quote_number
),
renamed AS (
  UPDATE jobs
  SET name = named.new_name, updated_at = now()
  FROM named
  WHERE jobs.id = named.id
  RETURNING jobs.id, named.org_id, named.contact_id, named.old_name, named.new_name
)
INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, contact_id, changes)
SELECT org_id, NULL, 'updated', 'job', id, contact_id, jsonb_build_array(jsonb_build_object('field', 'name', 'from', old_name, 'to', new_name))
FROM renamed;
