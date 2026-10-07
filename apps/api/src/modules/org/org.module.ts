import { ModulesController } from "./modules.controller";
import { ModulesService } from "./modules.service";
import { AuditModule } from "../audit/audit.module";
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
import { IndustryTemplateService } from "./industry-template.service";
import { SettingsService } from "./settings.service";
import { QuoteConversionGuardService } from "./quote-conversion-guard.service";

@Module({
  imports: [TeamsModule, AuditModule],
  controllers: [ModulesController, SettingsController, AccountsController, InvitationsController, PublicInvitationsController, PublicSignupController, PublicPasswordResetController, MembersController],
  providers: [SettingsService, AccountsService, MembersService, QuoteConversionGuardService, IndustryTemplateService, ModulesService],
  exports: [SettingsService, AccountsService, MembersService, QuoteConversionGuardService, IndustryTemplateService, ModulesService],
})
export class OrgModule {}
