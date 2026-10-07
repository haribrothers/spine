Spine export to Tally — Kaveri Interiors
Period: 2026-09-01 to 2026-09-30

HOW TO IMPORT
1. In Tally, open (or create) the company. Its books must begin on or before the first date above.
2. TallyPrime: Gateway of Tally > Import > Masters, choose masters.xml.
   Tally.ERP 9: Gateway of Tally > Import of Data > Masters, choose masters.xml.
3. Then import the transactions: TallyPrime: Gateway of Tally > Import > Transactions, choose vouchers.xml.
   Tally.ERP 9: Gateway of Tally > Import of Data > Vouchers, choose vouchers.xml.
4. Check the import log in Tally, then compare the Trial Balance with Spine's for the same dates.

WHAT'S IN THE FILES
masters.xml: 7 ledgers — every account used in the period under its Tally group, customers under Sundry Debtors and vendors under Sundry Creditors (with address, state and GSTIN).
vouchers.xml: one voucher per journal entry, balanced, with bill-wise references to the invoice or bill number:
  Sales: 1
  Receipt: 1
  Purchase: 1

ACCOUNTS ON SPINE'S DEFAULT GROUP
Nobody has chosen a Tally group for these, so they use the default for their type and code. Change them in Spine: Reports > Export to Tally > Account mapping.
  5000 Cost of Materials -> Direct Expenses

Spine prepares these files; your accountant imports and checks them in Tally.
