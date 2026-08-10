import { Module } from "@nestjs/common";
import { OrgModule } from "../org/org.module";
import { AuditModule } from "../audit/audit.module";
import { ReportsModule } from "../reports/reports.module";
import { TaxController } from "./tax.controller";
import { TaxRatesController } from "./tax-rates.controller";
import { TaxRatesService } from "./tax-rates.service";
import { TaxGroupsController } from "./tax-groups.controller";
import { TaxGroupsService } from "./tax-groups.service";
import { TaxResolverService } from "./tax-resolver.service";

@Module({
  imports: [OrgModule, AuditModule, ReportsModule],
  controllers: [TaxController, TaxRatesController, TaxGroupsController],
  providers: [TaxRatesService, TaxGroupsService, TaxResolverService],
  exports: [TaxRatesService, TaxGroupsService, TaxResolverService],
})
export class TaxModule {}
