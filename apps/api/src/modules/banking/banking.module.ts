import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";
import { TaxModule } from "../tax/tax.module";
import { ReportsModule } from "../reports/reports.module";
import { TaxPaymentsController, TaxRefundsController } from "../tax/tax-payments.controller";
import { TaxPaymentsService } from "../tax/tax-payments.service";
import { AccountRegisterService } from "./account-register.service";
import { BankTransactionsController } from "./bank-transactions.controller";
import { BankTransactionsService } from "./bank-transactions.service";
import { BankTransfersController } from "./bank-transfers.controller";
import { BankTransfersService } from "./bank-transfers.service";
import { MoneyAccountsController } from "./money-accounts.controller";
import { MoneyAccountsService } from "./money-accounts.service";
import { ReconciliationsController } from "./reconciliations.controller";
import { ReconciliationsService } from "./reconciliations.service";
import { ReconciliationReportService } from "./reconciliation-report.service";
import { OrgModule } from "../org/org.module";
import { StatementImportsController } from "./statement-imports.controller";
import { StatementImportsService } from "./statement-imports.service";

/**
 * Module 20 Banking (D-139): bank, cash and card accounts, their registers,
 * transfers, other money in and out, and reconciliation. Tax payments and
 * refunds (US-TAX-08) live here too: they move money and need the money
 * accounts, and TaxModule is already imported by this one.
 */
@Module({
  imports: [AuditModule, LedgerModule, TaxModule, ReportsModule, OrgModule],
  controllers: [MoneyAccountsController, BankTransfersController, BankTransactionsController, TaxPaymentsController, TaxRefundsController, StatementImportsController, ReconciliationsController],
  providers: [MoneyAccountsService, AccountRegisterService, BankTransfersService, BankTransactionsService, TaxPaymentsService, StatementImportsService, ReconciliationsService, ReconciliationReportService],
  exports: [MoneyAccountsService, AccountRegisterService, BankTransactionsService, BankTransfersService, StatementImportsService, ReconciliationsService],
})
export class BankingModule {}
