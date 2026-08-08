import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./auth/auth";
import { DbModule } from "./db/db.module";
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
import { DemoDataModule } from "./modules/demo-data/demo-data.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { QueueModule } from "./modules/queue/queue.module";
import { EmailModule } from "./modules/email/email.module";
import { PdfModule } from "./modules/pdf/pdf.module";

@Module({
  imports: [
    // PRD §10.3 — "with rate limiting". App-wide default is generous (this
    // guard applies to every route unless overridden); `PublicQuotesController`
    // overrides it to a much tighter per-route limit via its own `@Throttle`
    // decorator, since that's the one place an anonymous, zero-cost caller
    // can reach the API at all. In-memory storage (the default, no `storage`
    // option set) — no Redis, matching CLAUDE.md's single-host stack table;
    // acceptable since this is a single-process deployment, so in-memory
    // state doesn't need to be shared across instances.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    AuthModule.forRoot({ auth, isGlobal: true }),
    DbModule,
    QueueModule,
    EmailModule,
    PdfModule,
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
    DemoDataModule,
    DashboardModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
