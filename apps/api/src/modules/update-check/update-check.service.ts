import { Inject, Injectable, Logger } from "@nestjs/common";
import { SPINE_RELEASES_REPO, type UpdateStatus } from "@spine/shared";
import { spineVersion } from "../../common/version";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { organization } from "../../db/schema";
import { SettingsService } from "../org/settings.service";

export const UPDATE_CHECK_KEY = "update_check";
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${SPINE_RELEASES_REPO}/releases/latest`;
const TIMEOUT_MS = 10_000;

/** What the daily check stores, per business (`settings` key `update_check`). */
export interface UpdateCheckRecord {
  latestVersion: string;
  releaseUrl: string;
  checkedAt: string;
}

/** `UPDATE_CHECK=off` (any case) turns the check off; anything else leaves it on (D-055). */
export const updateCheckEnabled = () => process.env.UPDATE_CHECK?.trim().toLowerCase() !== "off";

/**
 * US-OPS-06 (D-055, D-269) — asks GitHub Releases for the latest release
 * (`/releases/latest` never returns a draft or a pre-release) and stores it
 * for the Owners' banner. The request carries nothing about this install:
 * no version, no URL, no id — only the headers GitHub requires. A failure
 * is logged and keeps the last result.
 */
@Injectable()
export class UpdateCheckService {
  private readonly logger = new Logger("Update check");

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
  ) {}

  async check(now = new Date()): Promise<UpdateCheckRecord | null> {
    if (!updateCheckEnabled()) return null;
    let release: { tag_name?: unknown; html_url?: unknown; draft?: unknown; prerelease?: unknown };
    try {
      const res = await fetch(LATEST_RELEASE_URL, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "Spine" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`Couldn't check for a new version: GitHub answered ${res.status}. Spine tries again tomorrow.`);
        return null;
      }
      release = (await res.json()) as typeof release;
    } catch (err) {
      this.logger.warn(`Couldn't check for a new version: ${(err as Error).message}. Spine tries again tomorrow.`);
      return null;
    }
    if (typeof release.tag_name !== "string" || release.draft === true || release.prerelease === true) return null;
    const record: UpdateCheckRecord = {
      latestVersion: release.tag_name.replace(/^v/, ""),
      releaseUrl: typeof release.html_url === "string" ? release.html_url : `https://github.com/${SPINE_RELEASES_REPO}/releases`,
      checkedAt: now.toISOString(),
    };
    for (const org of await this.db.select({ id: organization.id }).from(organization)) {
      await this.settings.set(org.id, UPDATE_CHECK_KEY, record);
    }
    return record;
  }

  /** Whether the stored result is missing or more than a day old, so start-up checks now. */
  async isStale(now = new Date()): Promise<boolean> {
    const [org] = await this.db.select({ id: organization.id }).from(organization).limit(1);
    if (!org) return false;
    const record = await this.settings.get<UpdateCheckRecord>(org.id, UPDATE_CHECK_KEY);
    return !record || now.getTime() - new Date(record.checkedAt).getTime() > 86_400_000;
  }

  async status(orgId: string): Promise<UpdateStatus> {
    const current = spineVersion();
    if (!updateCheckEnabled()) return { current };
    const record = await this.settings.get<UpdateCheckRecord>(orgId, UPDATE_CHECK_KEY);
    if (!record) return { current };
    return { current, latest: record.latestVersion, releaseUrl: record.releaseUrl, checkedAt: record.checkedAt };
  }
}
