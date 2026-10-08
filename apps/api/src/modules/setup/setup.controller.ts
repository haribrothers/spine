import { Body, Controller, Get, Param, Put, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { setSetupHiddenSchema } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { requireOrgId } from "../org/settings.controller";
import { SetupService } from "./setup.service";

/** US-ONB-15 — the Set up Spine page is Owner-only, like Settings. */
@Controller("org/setup-status")
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get()
  @OrgRoles(["owner"])
  async status(@Session() session: UserSession) {
    return this.setup.status(requireOrgId(session));
  }

  /** "Mark as not needed" and bringing a card back. */
  @Put(":key/hidden")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async setHidden(@Session() session: UserSession, @Param("key") key: string, @Body(new ZodValidationPipe(setSetupHiddenSchema)) body: { hidden: boolean }) {
    return this.setup.setHidden(requireOrgId(session), key, body.hidden);
  }
}
