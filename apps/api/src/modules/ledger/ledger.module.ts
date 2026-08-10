import { Module } from "@nestjs/common";
import { LedgerService } from "./ledger.service";
import { PeriodsService } from "./periods.service";
import { PeriodsController } from "./periods.controller";

@Module({
  controllers: [PeriodsController],
  providers: [LedgerService, PeriodsService],
  exports: [LedgerService, PeriodsService],
})
export class LedgerModule {}
