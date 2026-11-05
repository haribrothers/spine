---
title: How the ledger works
description: Derived postings, immutable entries, and the posting rules table.
sidebar:
  order: 3
---

Spine is double-entry accounting that nobody has to type. Every business event that moves money posts a balanced journal entry automatically, in the same transaction as the document, so the books can never disagree with the documents.

## Derived, never authored

A domain service (issuing an invoice, recording a payment, approving an expense) calls the one posting-rules module, which turns the event into journal lines. The document and its entry commit together or not at all. There is no "post to books" button and no way to type a journal line for a business document. (Manual journals exist for an accountant's adjustments, and they post through the same rules: balanced, immutable.)

## Immutable

Journal entries and lines are never updated or deleted — Postgres triggers reject it, and a deferred constraint rejects any entry whose debits and credits differ at commit. A correction is a new, reversing entry: voiding an invoice posts the exact reverse of its issue.

## Some of the rules

| Event | Debit | Credit |
|---|---|---|
| Invoice issued | 1100 Accounts Receivable (total) | Revenue per line, 2100 Output Tax |
| Progress invoice with retention | 1100 AR (total − retention), 1150 Retention Receivable | Revenue per line, 2100 Output Tax |
| Payment received, allocated | The money account | 1100 AR |
| Payment received, not yet allocated | The money account | 2200 Customer Advances |
| Credit note issued | Revenue, 2100 Output Tax | 1100 AR (up to the balance), 2200 Customer Advances (any excess) |
| Invoice voided | Reverses the issue exactly | |
| Retention released | 1100 AR | 1150 Retention Receivable |
| Vendor bill recorded | Expense per line, 1200 Input Tax | 2000 Accounts Payable |
| Vendor payment | 2000 AP | The money account |
| Expense approved | The category's expense account, 1200 Input Tax | The money account |

The complete table, with every account and edge case, is [06-ledger-posting-rules](https://github.com/haribrothers/spine/blob/main/docs/prd/06-ledger-posting-rules.md).

## Reports come from the lines

Profit and loss, the balance sheet, cash flow, receivables and payables aging, and job profitability are all queries over journal lines, filtered by account, contact or job. There's no second set of numbers to drift out of step.
