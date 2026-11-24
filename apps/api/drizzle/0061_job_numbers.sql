-- US-JOB-22: every job gets a permanent number from the org's Job sequence
-- (default "JOB", padding 3). Existing jobs are numbered in creation order,
-- starting from the sequence's next value, and the sequence moves past them.
ALTER TABLE "jobs" ADD COLUMN "number" text;--> statement-breakpoint
WITH seq AS (
  SELECT
    o.id AS org_id,
    coalesce(ns.prefix, 'JOB') AS prefix,
    coalesce(ns.padding, 3) AS padding,
    coalesce(ns.next_value, 1) AS start,
    ns.year_token
  FROM organization o
  LEFT JOIN number_sequences ns ON ns.org_id = o.id AND ns.document_type = 'job'
),
numbered AS (
  SELECT j.id, j.org_id, row_number() OVER (PARTITION BY j.org_id ORDER BY j.created_at, j.id) AS n
  FROM jobs j
  WHERE j.number IS NULL
),
formatted AS (
  SELECT n.id, s.prefix, s.year_token, s.padding, (s.start + n.n - 1)::text AS value
  FROM numbered n
  JOIN seq s ON s.org_id = n.org_id
)
UPDATE jobs
SET number = f.prefix || '-' || CASE WHEN f.year_token IS NOT NULL THEN f.year_token || '-' ELSE '' END
  || CASE WHEN length(f.value) >= f.padding THEN f.value ELSE lpad(f.value, f.padding, '0') END
FROM formatted f
WHERE jobs.id = f.id;--> statement-breakpoint
INSERT INTO number_sequences (org_id, document_type, prefix, padding, next_value)
SELECT org_id, 'job', 'JOB', 3, count(*) + 1
FROM jobs
GROUP BY org_id
ON CONFLICT (org_id, document_type) DO UPDATE
SET next_value = number_sequences.next_value + EXCLUDED.next_value - 1, updated_at = now();--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_org_number_unique" ON "jobs" USING btree ("org_id","number");
