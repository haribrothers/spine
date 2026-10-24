import { Controller, Get, Inject } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { BackupStatus } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { backupStatus } from "../../ops/backup/backup-status";
import { requireOrgId } from "../org/settings.controller";

/** US-OPS-03 (D-105) — when the last backup ran, for the Owners' "back up" banner. */
@Controller("org/backup-status")
export class BackupsController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  @OrgRoles(["owner"])
  async get(@Session() session: UserSession): Promise<BackupStatus> {
    return backupStatus(this.db, requireOrgId(session));
  }
}
