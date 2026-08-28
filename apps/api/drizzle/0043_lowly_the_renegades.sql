ALTER TABLE "job_photos" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Hand-appended data migration (same file as the drizzle-kit-generated
-- schema change above) — Phase 3 of extending the own/others privilege
-- split (PRD §9) to Jobs & Milestones. Backfills existing `job_photos`
-- rows' new `created_by_user_id` from their existing `uploaded_by_user_id`
-- (same person, duplicated under the standard column name — see jobs.ts's
-- own doc comment on job_photos.createdByUserId) so pre-migration photos
-- aren't treated as unowned. `milestones.created_by_user_id` is left NULL
-- for existing rows — there is no prior "who defined this milestone set"
-- data to backfill from, so existing milestone sets are correctly unowned
-- until the next `PUT /:id/milestones` call sets it.
--
-- Also backfills `jobs.update_milestones`'s existing Team grants onto the
-- new Phase 3 capabilities it's replaced by:
--
--   jobs.update_milestones -> jobs.edit_own, jobs.edit_others,
--                              jobs.release_retention,
--                              milestones.edit_own, milestones.edit_others,
--                              milestones.invoice,
--                              job_notes.edit_own, job_notes.edit_others,
--                              job_photos.edit_own, job_photos.edit_others,
--                              variation_orders.edit_own, variation_orders.edit_others,
--                              variation_orders.apply
--
-- Safe to re-run: guarded by WHERE NOT EXISTS per capability.

UPDATE job_photos SET created_by_user_id = uploaded_by_user_id WHERE created_by_user_id IS NULL;--> statement-breakpoint

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, cap.capability, tp.granted
FROM team_privileges tp
CROSS JOIN (VALUES
	('jobs.edit_own'),
	('jobs.edit_others'),
	('jobs.release_retention'),
	('milestones.edit_own'),
	('milestones.edit_others'),
	('milestones.invoice'),
	('job_notes.edit_own'),
	('job_notes.edit_others'),
	('job_photos.edit_own'),
	('job_photos.edit_others'),
	('variation_orders.edit_own'),
	('variation_orders.edit_others'),
	('variation_orders.apply')
) AS cap(capability)
WHERE tp.capability = 'jobs.update_milestones'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = cap.capability
	);--> statement-breakpoint

DELETE FROM team_privileges WHERE capability = 'jobs.update_milestones';