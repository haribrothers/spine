-- Hand-authored (not drizzle-kit generated) — no schema change needed,
-- `invoices`/`payments`/`credit_notes` already had `created_by_user_id`
-- since their own original migrations. Phase 4 (final phase) of extending
-- the own/others privilege split (PRD §9) to Invoices, Payments, and
-- Credit Notes: `invoices.manage` is replaced by three independent
-- own/others capability groups plus dedicated workflow-action
-- capabilities for the one-way transitions that were never ownership
-- questions (issue/void/send/send_reminder/apply_credit/send_receipt).
--
-- Backfills every existing Team's `invoices.manage` grant onto all 19 new
-- capabilities:
--
--   invoices.manage -> invoices.edit_own, invoices.edit_others,
--                       invoices.delete_own, invoices.delete_others,
--                       invoices.issue, invoices.void, invoices.send,
--                       invoices.send_reminder,
--                       payments.edit_own, payments.edit_others,
--                       payments.delete_own, payments.delete_others,
--                       payments.apply_credit, payments.send_receipt,
--                       credit_notes.edit_own, credit_notes.edit_others,
--                       credit_notes.delete_own, credit_notes.delete_others,
--                       credit_notes.issue
--
-- Safe to re-run: guarded by WHERE NOT EXISTS per capability.

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, cap.capability, tp.granted
FROM team_privileges tp
CROSS JOIN (VALUES
	('invoices.edit_own'),
	('invoices.edit_others'),
	('invoices.delete_own'),
	('invoices.delete_others'),
	('invoices.issue'),
	('invoices.void'),
	('invoices.send'),
	('invoices.send_reminder'),
	('payments.edit_own'),
	('payments.edit_others'),
	('payments.delete_own'),
	('payments.delete_others'),
	('payments.apply_credit'),
	('payments.send_receipt'),
	('credit_notes.edit_own'),
	('credit_notes.edit_others'),
	('credit_notes.delete_own'),
	('credit_notes.delete_others'),
	('credit_notes.issue')
) AS cap(capability)
WHERE tp.capability = 'invoices.manage'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = cap.capability
	);

DELETE FROM team_privileges WHERE capability = 'invoices.manage';
