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
import { TaxProfileService } from "./tax-profile.service";
import { PlaceOfSupplyService } from "./place-of-supply.service";
import { Gstr1Controller } from "./gstr1/gstr1.controller";
import { Gstr1Service } from "./gstr1/gstr1.service";

@Module({
  imports: [OrgModule, AuditModule, ReportsModule],
  controllers: [TaxController, TaxRatesController, TaxGroupsController, Gstr1Controller],
  providers: [TaxRatesService, TaxGroupsService, TaxResolverService, TaxProfileService, PlaceOfSupplyService, Gstr1Service],
  exports: [TaxRatesService, TaxGroupsService, TaxResolverService, TaxProfileService, PlaceOfSupplyService],
})
export class TaxModule {}
