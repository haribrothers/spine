import { Controller, Get } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { UpdateStatus } from "@spine/shared";
import { requireOrgId } from "../org/settings.controller";
import { UpdateCheckService } from "./update-check.service";

/** US-OPS-06 (D-055) — the running version and the latest release, for the Owners' update banner. */
@Controller("org/update-status")
export class UpdateCheckController {
  constructor(private readonly updateCheck: UpdateCheckService) {}

  @Get()
  @OrgRoles(["owner"])
  async get(@Session() session: UserSession): Promise<UpdateStatus> {
    return this.updateCheck.status(requireOrgId(session));
  }
}
