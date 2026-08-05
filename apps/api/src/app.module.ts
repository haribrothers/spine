import { Module } from "@nestjs/common";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./auth/auth";
import { HealthModule } from "./health/health.module";
import { OrgModule } from "./modules/org/org.module";
import { UsersModule } from "./modules/users/users.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { QuotesModule } from "./modules/quotes/quotes.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PurchasesModule } from "./modules/purchases/purchases.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { TaxModule } from "./modules/tax/tax.module";
import { NumberingModule } from "./modules/numbering/numbering.module";
import { FilesModule } from "./modules/files/files.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AuditModule } from "./modules/audit/audit.module";

@Module({
  imports: [
    AuthModule.forRoot({ auth, isGlobal: true }),
    HealthModule,
    OrgModule,
    UsersModule,
    ContactsModule,
    CatalogModule,
    QuotesModule,
    JobsModule,
    InvoicesModule,
    PaymentsModule,
    PurchasesModule,
    ExpensesModule,
    LedgerModule,
    ReportsModule,
    TaxModule,
    NumberingModule,
    FilesModule,
    NotificationsModule,
    AuditModule,
  ],
})
export class AppModule {}
