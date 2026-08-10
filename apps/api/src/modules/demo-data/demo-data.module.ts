import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { QuotesModule } from "../quotes/quotes.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { PaymentsModule } from "../payments/payments.module";
import { JobsModule } from "../jobs/jobs.module";
import { OrgModule } from "../org/org.module";
import { TaxModule } from "../tax/tax.module";
import { PurchasesModule } from "../purchases/purchases.module";
import { DemoDataController } from "./demo-data.controller";
import { DemoDataService } from "./demo-data.service";

@Module({
  imports: [AuditModule, QuotesModule, InvoicesModule, PaymentsModule, JobsModule, OrgModule, TaxModule, PurchasesModule],
  controllers: [DemoDataController],
  providers: [DemoDataService],
  exports: [DemoDataService],
})
export class DemoDataModule {}
