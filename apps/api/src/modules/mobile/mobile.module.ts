import { Module } from "@nestjs/common";
import { MobileController } from "./mobile.controller";
import { MobileTodayService } from "./mobile-today.service";

/** Phase 5 — API reads made for the field app (US-MOB-03). */
@Module({
  controllers: [MobileController],
  providers: [MobileTodayService],
})
export class MobileModule {}
