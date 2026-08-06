import { Module } from "@nestjs/common";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";
import { InvitationsController } from "./invitations.controller";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  controllers: [SettingsController, AccountsController, InvitationsController, MembersController],
  providers: [SettingsService, AccountsService, MembersService],
  exports: [SettingsService, AccountsService, MembersService],
})
export class OrgModule {}
