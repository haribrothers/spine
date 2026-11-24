import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { mockRouter } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { queueCompletion, queueExpense, queuePhotos } from "../test-utils/outbox";
import { outbox } from "../lib/outbox/outbox";
import { syncEngine } from "../lib/outbox/sync-engine";
import { connectivity } from "../lib/connectivity";
import { ALL_SYNCED_MESSAGE, SyncScreen, syncReason } from "../features/sync/sync-screen";
import { SyncPill } from "../components/sync-pill";
import { ProfileScreen } from "../features/profile/profile-screen";
import type { Transport } from "../lib/outbox/send";

describe("US-MOB-08 · see what's waiting to sync", () => {
  beforeEach(() => mockRouter.push.mockClear());

  it("puts '<n> waiting to sync' on the pill in the due-soon colour, 'All synced' when done, and opens Sync", async () => {
    renderWithSession(<SyncPill />);
    expect(screen.getByText("All synced")).toBeTruthy();
    await act(async () => {
      await queuePhotos();
      await queueExpense();
      await queueCompletion();
    });
    expect(screen.getByText("3 waiting to sync")).toBeTruthy();
    expect(screen.getByTestId("sync-pill").props.className ?? "").toBeDefined();
    fireEvent.press(screen.getByTestId("sync-pill"));
    expect(mockRouter.push).toHaveBeenCalledWith("/sync");
  });

  it("opens Sync from Profile's sync row too", async () => {
    await queuePhotos();
    renderWithSession(<ProfileScreen />);
    expect(screen.getByText("1 waiting to sync")).toBeTruthy();
    fireEvent.press(screen.getByTestId("profile-sync"));
    expect(mockRouter.push).toHaveBeenCalledWith("/sync");
  });

  it("lists NEEDS FIXING, WAITING (what, which job, when) and SENT TODAY under '<n> items waiting' and why", async () => {
    connectivity.set(false);
    const failed = await queueExpense();
    await outbox.update(failed.id, { status: "failed", error: "Didn't send: the receipt photo is over 10 MB." });
    const photos = await queuePhotos();
    await queueCompletion();
    const sent = await queuePhotos("job-townhomes", "Phase 2 townhomes", 4);
    await outbox.update(sent.id, { status: "sent", sentAt: Date.now() });
    renderWithSession(<SyncScreen />);
    expect(screen.getByTestId("sync-title").props.children).toBe("3 items waiting");
    expect(screen.getByTestId("sync-reason").props.children).toBe("You're offline · sends automatically when you reconnect");
    expect(screen.getByText("NEEDS FIXING · 1")).toBeTruthy();
    expect(screen.getByText("Expense · Fuel & Vehicle · $64.20")).toBeTruthy();
    expect(screen.getByText("Didn't send: the receipt photo is over 10 MB.")).toBeTruthy();
    expect(screen.getByText("WAITING")).toBeTruthy();
    expect(screen.getByText("2 site photos")).toBeTruthy();
    expect(screen.getByText(/^Marina office fit-out · /)).toBeTruthy();
    expect(screen.getByText("Milestone completed")).toBeTruthy();
    expect(screen.getByText("SENT TODAY")).toBeTruthy();
    expect(screen.getByText("4 site photos")).toBeTruthy();
    fireEvent.press(screen.getByTestId(`sync-fix-${failed.id}`));
    expect(mockRouter.push).toHaveBeenCalledWith(`/sync/fix/${failed.id}`);
    expect(screen.getByTestId(`sync-waiting-${photos.id}`)).toBeTruthy();
  });

  it("sends waiting items at once with Try sending now, even during back-off", async () => {
    const item = await queueExpense({ receipt: null });
    await outbox.update(item.id, { attempts: 2, nextAttemptAt: Date.now() + 60_000 });
    const transport = jest.fn(async () => ({ id: "exp-1" })) as unknown as Transport;
    syncEngine.setTransport(transport);
    renderWithSession(<SyncScreen />);
    await act(async () => fireEvent.press(screen.getByTestId("sync-now")));
    await waitFor(() => expect(outbox.get(item.id)?.status).toBe("sent"));
    expect(screen.getByTestId("sync-title").props.children).toBe("All synced");
    expect(screen.getByText(ALL_SYNCED_MESSAGE)).toBeTruthy();
    expect(screen.queryByTestId("sync-now")).toBeNull();
  });

  it("says why nothing is going out", () => {
    expect(syncReason(null, false, false)).toBe("You're offline · sends automatically when you reconnect");
    expect(syncReason("unreachable", true, false)).toBe("Couldn't reach your Spine server · tries again automatically");
    expect(syncReason("updateRequired", true, false)).toBe("Update Spine to send them · they're kept on this phone");
    expect(syncReason(null, true, true)).toBe("Sending now…");
  });
});
