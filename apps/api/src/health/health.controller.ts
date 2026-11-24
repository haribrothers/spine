import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { spineVersion } from "../common/version";
import { FilesService } from "../modules/files/files.service";
import { HealthService } from "./health.service";

/** "The database isn't reachable." / "The database and the job queue aren't reachable." */
function downMessage(down: string[]): string {
  return down.length === 1 ? `The ${down[0]} isn't reachable.` : `The ${down.join(" and the ")} aren't reachable.`;
}

@Controller("health")
export class HealthController {
  constructor(
    private readonly files: FilesService,
    private readonly health: HealthService,
  ) {}

  @Get()
  @AllowAnonymous()
  check() {
    // US-MOB-01 — the field app checks the address it was given is a Spine
    // server (`service`) and opens "Forgot password?" on the web app (`appUrl`).
    // US-OPS-52 — the version, so Settings › About and the field app can show it (and "Beta").
    return { status: "ok", service: "spine", appUrl: process.env.APP_URL ?? null, version: spineVersion() };
  }

  /**
   * Readiness (US-OPS-05): 200 when the database and the job queue answer,
   * otherwise 503 naming which isn't reachable — Docker's healthcheck and
   * monitors use it. Also reports file storage (US-OPS-31): the driver and,
   * for the `local` driver, how full the files volume is.
   */
  @Get("ready")
  @AllowAnonymous()
  async ready(@Res({ passthrough: true }) res: Response) {
    const [database, queue] = await Promise.all([this.health.database(), this.health.jobQueue()]);
    const storage = await this.files.storageStatus().catch(() => null);
    const down = [...(database ? [] : ["database"]), ...(queue ? [] : ["job queue"])];
    const checks = { database: database ? "ok" : "unreachable", queue: queue ? "ok" : "unreachable" } as const;
    if (down.length) {
      res.status(503);
      return { status: "unavailable", ...checks, storage, message: downMessage(down) };
    }
    return { status: "ok", ...checks, storage };
  }
}
