-- US-TEAM-30 (D-235): every section stays open for every existing Team until an Owner closes one.
INSERT INTO team_privileges (id, team_id, capability, granted)
SELECT gen_random_uuid(), t.id, c.capability, true
FROM teams t
CROSS JOIN (VALUES
	('contacts.open'), ('catalog.open'), ('leads.open'), ('quotes.open'), ('invoices.open'), ('payments.open'), ('credit_notes.open'),
	('expenses.view_others'), ('vendor_bills.open'), ('vendor_credits.open'), ('vendor_payments.open'), ('jobs.open'), ('meetings.open')
) AS c(capability)
ON CONFLICT (team_id, capability) DO NOTHING;
