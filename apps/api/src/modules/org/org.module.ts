import { Module } from "@nestjs/common";
import { TeamsModule } from "../teams/teams.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";
import { InvitationsController } from "./invitations.controller";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";
import { PublicInvitationsController } from "./public-invitations.controller";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [TeamsModule],
  controllers: [SettingsController, AccountsController, InvitationsController, PublicInvitationsController, MembersController],
  providers: [SettingsService, AccountsService, MembersService],
  exports: [SettingsService, AccountsService, MembersService],
})
export class OrgModule {}
