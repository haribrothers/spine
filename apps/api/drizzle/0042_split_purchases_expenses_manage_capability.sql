-- Hand-authored (not drizzle-kit generated) — same pattern as 0036/0037/
-- 0039/0040. Phase 2 of extending the own/others privilege split (PRD §9)
-- to Purchases: `expenses.submit` and `purchases.manage` are replaced by
-- four independent own/others capability groups (Expenses, Expense
-- Categories, Vendor Bills, Vendor Payments) plus new dedicated
-- capabilities for workflow actions that aren't edits.
--
-- `expenses.approve` is UNCHANGED (same capability name, still a single
-- capability, not own/others — an approver reviewing someone else's
-- submission was never an ownership question) so it needs no migration;
-- only genuinely new capabilities need backfilling for existing teams:
--
--   expenses.submit    -> expenses.edit_own, expenses.edit_others,
--                         expenses.delete_own, expenses.delete_others,
--                         expenses.reject, expenses.mark_billed,
--                         expenses.bill_to_customer
--   purchases.manage   -> expense_categories.{edit,delete}_{own,others},
--                         vendor_bills.{edit,delete}_{own,others},
--                         vendor_bills.record, vendor_bills.void,
--                         vendor_payments.{edit,delete}_{own,others}
--
-- `expenses.reject`/`mark_billed`/`bill_to_customer` are backfilled from
-- `expenses.submit`'s grant (not `expenses.approve`'s) because reject was
-- previously gated by `expenses.approve` in code but is being kept
-- alongside approve conceptually as a reviewer action — however, since
-- this migration only has `expenses.submit`'s and `expenses.approve`'s
-- existing values to work from, and every team observed in production so
-- far grants both identically (submit implies approve in the "General
-- Staff" default), backfilling reject/mark_billed/bill_to_customer from
-- `expenses.approve` (their actual prior gate) is the correct, precise
-- choice — see the second INSERT block below.
--
-- Safe to re-run: guarded by WHERE NOT EXISTS per capability.

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, cap.capability, tp.granted
FROM team_privileges tp
CROSS JOIN (VALUES
	('expenses.edit_own'),
	('expenses.edit_others'),
	('expenses.delete_own'),
	('expenses.delete_others')
) AS cap(capability)
WHERE tp.capability = 'expenses.submit'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = cap.capability
	);

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, cap.capability, tp.granted
FROM team_privileges tp
CROSS JOIN (VALUES
	('expenses.reject'),
	('expenses.mark_billed'),
	('expenses.bill_to_customer')
) AS cap(capability)
WHERE tp.capability = 'expenses.approve'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = cap.capability
	);

INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), tp.team_id, cap.capability, tp.granted
FROM team_privileges tp
CROSS JOIN (VALUES
	('expense_categories.edit_own'),
	('expense_categories.edit_others'),
	('expense_categories.delete_own'),
	('expense_categories.delete_others'),
	('vendor_bills.edit_own'),
	('vendor_bills.edit_others'),
	('vendor_bills.delete_own'),
	('vendor_bills.delete_others'),
	('vendor_bills.record'),
	('vendor_bills.void'),
	('vendor_payments.edit_own'),
	('vendor_payments.edit_others'),
	('vendor_payments.delete_own'),
	('vendor_payments.delete_others')
) AS cap(capability)
WHERE tp.capability = 'purchases.manage'
	AND NOT EXISTS (
		SELECT 1 FROM team_privileges existing
		WHERE existing.team_id = tp.team_id AND existing.capability = cap.capability
	);

DELETE FROM team_privileges WHERE capability IN ('expenses.submit', 'purchases.manage');
