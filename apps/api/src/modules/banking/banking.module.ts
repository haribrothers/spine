import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";
import { TaxModule } from "../tax/tax.module";
import { TaxPaymentsController, TaxRefundsController } from "../tax/tax-payments.controller";
import { TaxPaymentsService } from "../tax/tax-payments.service";
import { AccountRegisterService } from "./account-register.service";
import { BankTransactionsController } from "./bank-transactions.controller";
import { BankTransactionsService } from "./bank-transactions.service";
import { BankTransfersController } from "./bank-transfers.controller";
import { BankTransfersService } from "./bank-transfers.service";
import { MoneyAccountsController } from "./money-accounts.controller";
import { MoneyAccountsService } from "./money-accounts.service";

/**
 * Module 20 Banking (D-139): bank, cash and card accounts, their registers,
 * transfers, other money in and out, and reconciliation. Tax payments and
 * refunds (US-TAX-08) live here too: they move money and need the money
 * accounts, and TaxModule is already imported by this one.
 */
@Module({
  imports: [AuditModule, LedgerModule, TaxModule],
  controllers: [MoneyAccountsController, BankTransfersController, BankTransactionsController, TaxPaymentsController, TaxRefundsController],
  providers: [MoneyAccountsService, AccountRegisterService, BankTransfersService, BankTransactionsService, TaxPaymentsService],
  exports: [MoneyAccountsService],
})
export class BankingModule {}
