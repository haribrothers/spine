import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { FilesService } from "../modules/files/files.service";
import { HealthController } from "./health.controller";
import type { HealthService } from "./health.service";

describe("US-OPS-52 · run a beta for testers", () => {
  it("GET /health says which version this server runs: the root package.json's", () => {
    const { version } = JSON.parse(readFileSync(resolve(process.cwd(), "../../package.json"), "utf8")) as { version: string };
    const controller = new HealthController({} as FilesService, {} as HealthService);
    expect(controller.check()).toMatchObject({ status: "ok", service: "spine", version });
  });
});
