import { Controller, Get, Inject } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "@thallesp/nestjs-better-auth";
import { signupStatus } from "../../auth/signup-policy";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";

/** US-AUTH-08 — whether `/signup` shows the first-account form or "This Spine is invite-only". */
@Controller("public/signup-status")
@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class PublicSignupController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  async status() {
    return signupStatus(this.db);
  }
}
