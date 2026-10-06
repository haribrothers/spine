import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { MoneyAccountsController } from "./money-accounts.controller";
import { MoneyAccountsService } from "./money-accounts.service";

/**
 * Module 20 Banking (D-139): bank, cash and card accounts, their registers,
 * transfers, other money in and out, and reconciliation.
 */
@Module({
  imports: [AuditModule],
  controllers: [MoneyAccountsController],
  providers: [MoneyAccountsService],
  exports: [MoneyAccountsService],
})
export class BankingModule {}
