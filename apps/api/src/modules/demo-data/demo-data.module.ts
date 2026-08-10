import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { QuotesModule } from "../quotes/quotes.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { PaymentsModule } from "../payments/payments.module";
import { CreditNotesModule } from "../credit-notes/credit-notes.module";
import { ContactsModule } from "../contacts/contacts.module";
import { JobsModule } from "../jobs/jobs.module";
import { OrgModule } from "../org/org.module";
import { TaxModule } from "../tax/tax.module";
import { PurchasesModule } from "../purchases/purchases.module";
import { FilesModule } from "../files/files.module";
import { TeamsModule } from "../teams/teams.module";
import { DemoDataController } from "./demo-data.controller";
import { DemoDataService } from "./demo-data.service";

@Module({
  imports: [AuditModule, QuotesModule, InvoicesModule, PaymentsModule, CreditNotesModule, ContactsModule, JobsModule, OrgModule, TaxModule, PurchasesModule, FilesModule, TeamsModule],
  controllers: [DemoDataController],
  providers: [DemoDataService],
  exports: [DemoDataService],
})
export class DemoDataModule {}
