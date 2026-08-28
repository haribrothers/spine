import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NumberingModule } from "../numbering/numbering.module";
import { LedgerModule } from "../ledger/ledger.module";
import { TaxModule } from "../tax/tax.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { VendorBillsController } from "./vendor-bills.controller";
import { VendorBillsService } from "./vendor-bills.service";
import { ExpenseCategoriesController } from "./expense-categories.controller";
import { ExpenseCategoriesService } from "./expense-categories.service";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";
import { VendorPaymentsController } from "./vendor-payments.controller";
import { VendorPaymentsService } from "./vendor-payments.service";

/**
 * PRD FEAT-07 (Phase 4 · Money Out & Books, Stage 2) — vendor bills
 * (S-07.1, S-07.5), expenses with an approval-gated posting trigger
 * (S-07.2/S-07.3 web-submission half, S-07.4, S-07.6 billable), and
 * vendor payments allocated across bills (S-07.8). S-07.7 (payables view)
 * lives in ReportsModule alongside receivables, not here — same split
 * Phase 2's Payments/Receivables already established. Imports
 * `NumberingModule` for the "expense"/"vendor_payment" document types,
 * `LedgerModule` for the shared posting primitive, `TaxModule` for
 * `TaxResolverService` (vendor bill lines reuse FEAT-08's tax rate/group
 * resolution exactly like invoice/quote lines), `AuditModule` for
 * audit-log writes on every mutation, `NotificationsModule` (added for
 * S-09.14/dashboard v2) so `ExpensesService.approve` can fire an
 * `expense_approved` notification, same `.notify()` pattern
 * `PaymentsService`/`PublicQuotesService` already use. `InvoicesModule`
 * is imported for `InvoicesService` — S-07.6's "bill to customer" action
 * (`ExpensesService.createInvoiceFromExpense`) composes a new draft
 * invoice the same way `MilestonesService.invoiceMilestone` does.
 */
@Module({
  imports: [AuditModule, NumberingModule, LedgerModule, TaxModule, NotificationsModule, InvoicesModule],
  controllers: [VendorBillsController, ExpenseCategoriesController, ExpensesController, VendorPaymentsController],
  providers: [VendorBillsService, ExpenseCategoriesService, ExpensesService, VendorPaymentsService],
  exports: [VendorBillsService, ExpenseCategoriesService, ExpensesService, VendorPaymentsService],
})
export class PurchasesModule {}
