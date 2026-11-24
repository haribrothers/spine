import { Module } from "@nestjs/common";
import { OrgModule } from "../org/org.module";
import { UpdateCheckController } from "./update-check.controller";
import { UpdateCheckService } from "./update-check.service";
import { UpdateCheckWorker } from "./update-check.worker";

@Module({
  imports: [OrgModule],
  controllers: [UpdateCheckController],
  providers: [UpdateCheckService, UpdateCheckWorker],
})
export class UpdateCheckModule {}
