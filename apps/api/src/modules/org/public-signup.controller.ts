import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "@thallesp/nestjs-better-auth";
import { signupStatus } from "../../auth/signup-policy";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";

/**
 * US-AUTH-08 — whether `/signup` shows the first-account form or "This Spine
 * is invite-only". Every `/login` and `/signup` load asks, and a whole
 * office shares one IP, so it keeps the global limit (300 a minute) rather
 * than a tighter one.
 */
@Controller("public/signup-status")
@Public()
export class PublicSignupController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  async status() {
    return signupStatus(this.db);
  }
}
