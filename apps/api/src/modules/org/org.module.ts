import { Module } from "@nestjs/common";
import { TeamsModule } from "../teams/teams.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";
import { InvitationsController } from "./invitations.controller";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";
import { PublicInvitationsController } from "./public-invitations.controller";
import { PublicPasswordResetController } from "./public-password-reset.controller";
import { PublicSignupController } from "./public-signup.controller";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { QuoteConversionGuardService } from "./quote-conversion-guard.service";

@Module({
  imports: [TeamsModule],
  controllers: [SettingsController, AccountsController, InvitationsController, PublicInvitationsController, PublicSignupController, PublicPasswordResetController, MembersController],
  providers: [SettingsService, AccountsService, MembersService, QuoteConversionGuardService],
  exports: [SettingsService, AccountsService, MembersService, QuoteConversionGuardService],
})
export class OrgModule {}
