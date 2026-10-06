import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";
import { TaxModule } from "../tax/tax.module";
import { AccountRegisterService } from "./account-register.service";
import { BankTransactionsController } from "./bank-transactions.controller";
import { BankTransactionsService } from "./bank-transactions.service";
import { BankTransfersController } from "./bank-transfers.controller";
import { BankTransfersService } from "./bank-transfers.service";
import { MoneyAccountsController } from "./money-accounts.controller";
import { MoneyAccountsService } from "./money-accounts.service";

/**
 * Module 20 Banking (D-139): bank, cash and card accounts, their registers,
 * transfers, other money in and out, and reconciliation.
 */
@Module({
  imports: [AuditModule, LedgerModule, TaxModule],
  controllers: [MoneyAccountsController, BankTransfersController, BankTransactionsController],
  providers: [MoneyAccountsService, AccountRegisterService, BankTransfersService, BankTransactionsService],
  exports: [MoneyAccountsService],
})
export class BankingModule {}
