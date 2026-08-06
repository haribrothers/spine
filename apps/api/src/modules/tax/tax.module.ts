import { Module } from "@nestjs/common";
import { OrgModule } from "../org/org.module";
import { TaxController } from "./tax.controller";

@Module({
  imports: [OrgModule],
  controllers: [TaxController],
})
export class TaxModule {}
