import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { FilesService } from "../modules/files/files.service";

@Controller("health")
export class HealthController {
  constructor(private readonly files: FilesService) {}

  @Get()
  @AllowAnonymous()
  check() {
    // US-MOB-01 — the field app checks the address it was given is a Spine
    // server (`service`) and opens "Forgot password?" on the web app (`appUrl`).
    return { status: "ok", service: "spine", appUrl: process.env.APP_URL ?? null };
  }

  /**
   * Readiness. Today it reports file storage (US-OPS-31): the driver and,
   * for the `local` driver, how full the files volume is. The database and
   * queue checks, with a 503 naming what's down, arrive with US-OPS-05.
   */
  @Get("ready")
  @AllowAnonymous()
  async ready() {
    return { status: "ok", storage: await this.files.storageStatus() };
  }
}
