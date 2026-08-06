import { Module } from "@nestjs/common";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";
import { InvitationsController } from "./invitations.controller";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  controllers: [SettingsController, AccountsController, InvitationsController],
  providers: [SettingsService, AccountsService],
  exports: [SettingsService, AccountsService],
})
export class OrgModule {}
