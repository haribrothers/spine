import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { FilesService } from "../modules/files/files.service";

@Controller("health")
export class HealthController {
  constructor(private readonly files: FilesService) {}

  @Get()
  @AllowAnonymous()
  check() {
    return { status: "ok" };
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
