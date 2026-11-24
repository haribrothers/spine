import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { backupWarningMessage } from "@spine/shared";

const state = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../lib/api-client", () => ({ apiClient: { get: state.get } }));

import { BackupBanner } from "../components/backup-banner";

describe("US-OPS-03", () => {
  beforeEach(() => state.get.mockReset());

  it("says how long it's been, or that there's never been a backup", () => {
    expect(backupWarningMessage({ lastBackupAt: "2026-10-20T02:00:00Z", daysSince: 3, stale: true })).toBe("Your last backup was 3 days ago. Run a backup to keep your data safe.");
    expect(backupWarningMessage({ lastBackupAt: null, daysSince: 5, stale: true })).toBe("Spine hasn't been backed up yet. Run a backup to keep your data safe.");
    expect(backupWarningMessage({ lastBackupAt: "2026-10-22T02:00:00Z", daysSince: 1, stale: false })).toBeNull();
    // While loading, or when the check fails (the banner resets its status to null), it says nothing.
    expect(backupWarningMessage(null)).toBeNull();
  });

  it("an Owner's banner shows when the last backup is more than 2 days old", async () => {
    state.get.mockResolvedValue({ lastBackupAt: "2026-10-20T02:00:00Z", daysSince: 3, stale: true });
    render(<BackupBanner />);
    await waitFor(() => expect(screen.getByTestId("backup-banner").textContent).toContain("Your last backup was 3 days ago. Run a backup to keep your data safe."));
    expect(state.get).toHaveBeenCalledWith("/org/backup-status");
  });

  it("shows nothing after a recent backup", async () => {
    state.get.mockResolvedValue({ lastBackupAt: "2026-10-23T02:00:00Z", daysSince: 0, stale: false });
    render(<BackupBanner />);
    await waitFor(() => expect(state.get).toHaveBeenCalled());
    expect(screen.queryByTestId("backup-banner")).toBeNull();
  });
});
