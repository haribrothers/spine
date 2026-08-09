import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { QuotesModule } from "../quotes/quotes.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { PaymentsModule } from "../payments/payments.module";
import { DemoDataController } from "./demo-data.controller";
import { DemoDataService } from "./demo-data.service";

@Module({
  imports: [AuditModule, QuotesModule, InvoicesModule, PaymentsModule],
  controllers: [DemoDataController],
  providers: [DemoDataService],
  exports: [DemoDataService],
})
export class DemoDataModule {}
