import { Alert, Platform } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { mockRouter, mockScreen } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { discardedFiles, missingFiles, photo, queueCompletion, queueExpense, queuePhotos } from "../test-utils/outbox";
import { outbox } from "../lib/outbox/outbox";
import { backoffMs, SyncEngine } from "../lib/outbox/sync-engine";
import { classify, rejectionMessage, type Transport } from "../lib/outbox/send";
import { ApiError, OfflineError, ServerUnreachableError, UpdateRequiredError } from "../lib/api/errors";
import { FixScreen } from "../features/sync/fix-screen";

jest.mock("../lib/outbox/pick-photo", () => ({ pickPhoto: jest.fn() }));
const { pickPhoto } = jest.requireMock("../lib/outbox/pick-photo") as { pickPhoto: jest.Mock };

type Call = { method: string; path: string; key?: string; body?: unknown };

/** A fake API: records calls; `fail(n)` makes the nth call throw. */
function fakeApi(responses: (call: Call) => unknown = () => ({ id: "srv-1" })) {
  const calls: Call[] = [];
  const failures = new Map<number, unknown>();
  const transport = jest.fn(async (method: string, path: string, options: { idempotencyKey?: string; body?: unknown } = {}) => {
    const call = { method, path, key: options.idempotencyKey, body: options.body };
    calls.push(call);
    const failure = failures.get(calls.length);
    if (failure) throw failure;
    return responses(call);
  }) as unknown as Transport;
  return { transport, calls, fail: (n: number, error: unknown) => failures.set(n, error) };
}

const NOW = 1_791_500_000_000;

const engines: SyncEngine[] = [];
function engineWith(transport: Transport, now = () => NOW) {
  const engine = new SyncEngine(outbox, now);
  engines.push(engine);
  engine.setTransport(transport);
  return engine;
}

describe("US-MOB-09 · send each item exactly once and fix failures", () => {
  afterEach(() => {
    Platform.OS = "ios";
    jest.restoreAllMocks();
    engines.splice(0).forEach((engine) => engine.stop());
  });

  it("sends photos step by step with keys derived from the item, then drops the phone's copies", async () => {
    const item = await queuePhotos("job-marina", "Marina office fit-out", 2);
    const api = fakeApi(({ path }) => (path === "/files" ? { id: `file-${api.calls.length}` } : { id: "photo" }));
    await engineWith(api.transport).run();
    expect(api.calls.map((c) => `${c.method} ${c.path} ${c.key}`)).toEqual([
      `POST /files ${item.id}:file:photo-0.jpg`,
      `POST /jobs/job-marina/photos ${item.id}:photo:photo-0.jpg`,
      `POST /files ${item.id}:file:photo-1.jpg`,
      `POST /jobs/job-marina/photos ${item.id}:photo:photo-1.jpg`,
    ]);
    expect(outbox.get(item.id)).toMatchObject({ status: "sent", sentAt: NOW });
    expect(discardedFiles).toEqual([photo(0).uri, photo(1).uri]);
  });

  it("after a lost answer, retries with the same key and doesn't upload again what already arrived", async () => {
    const item = await queuePhotos("job-marina", "Marina office fit-out", 1);
    const api = fakeApi(({ path }) => (path === "/files" ? { id: "file-1" } : { id: "photo" }));
    api.fail(2, new ServerUnreachableError()); // the attach's answer is lost
    const engine = engineWith(api.transport);
    await engine.run();
    expect(outbox.get(item.id)).toMatchObject({ status: "waiting", attempts: 1 });
    await engine.run({ force: true });
    expect(api.calls.map((c) => c.key)).toEqual([`${item.id}:file:photo-0.jpg`, `${item.id}:photo:photo-0.jpg`, `${item.id}:photo:photo-0.jpg`]);
    expect(outbox.get(item.id)?.status).toBe("sent");
  });

  it("sends an expense: its receipt first, then the expense under the item's own key", async () => {
    const item = await queueExpense();
    const api = fakeApi(({ path }) => (path === "/files" ? { id: "file-r" } : { id: "exp-1" }));
    await engineWith(api.transport).run();
    expect(api.calls[0]).toMatchObject({ path: "/files", key: `${item.id}:file:receipt.jpg` });
    expect(api.calls[1]).toMatchObject({ path: "/expenses", key: item.id, body: expect.objectContaining({ categoryId: "cat-fuel", amount: "6420", receiptFileId: "file-r", paidBy: "employee" }) });
    expect(outbox.get(item.id)).toMatchObject({ status: "sent", result: { expenseId: "exp-1" } });
  });

  it("keeps a network failure Waiting and retries with back-off, never Failed", async () => {
    const item = await queueExpense({ receipt: null });
    const api = fakeApi();
    api.fail(1, new OfflineError());
    const engine = engineWith(api.transport);
    await engine.run();
    expect(outbox.get(item.id)).toMatchObject({ status: "waiting", attempts: 1, nextAttemptAt: NOW + 5_000, error: null });
    expect(engine.snapshot().problem).toBe("offline");
    await engine.run(); // back-off not over: nothing sent
    expect(api.calls).toHaveLength(1);
    expect([1, 2, 3, 10].map(backoffMs)).toEqual([5_000, 10_000, 20_000, 300_000]);
    expect(classify(new ApiError("busy", 503))).toBe("transient");
    expect(classify(new ApiError("in progress", 409))).toBe("transient");
  });

  it("marks a refused item Failed in red with the reason, and goes on with the next", async () => {
    const refused = await queueExpense();
    const next = await queueCompletion();
    const api = fakeApi(({ path }) => (path.endsWith("/complete") ? { id: "m-9" } : { id: "x" }));
    api.fail(1, new ApiError("This file is over 10 MB.", 413));
    await engineWith(api.transport).run();
    expect(outbox.get(refused.id)).toMatchObject({ status: "failed", error: "Didn't send: the receipt photo is over 10 MB." });
    expect(outbox.get(next.id)?.status).toBe("sent");
    expect(rejectionMessage(next, new ApiError("Job not found", 404))).toBe("Didn't send: this job isn't on your list any more.");
    expect(rejectionMessage(refused, new ApiError("Choose a category.", 400))).toBe("Didn't send: choose a category.");
  });

  it("refuses a photo over 10 MB on the phone, before sending anything", async () => {
    const item = await queueExpense({ receipt: photo(9, { name: "receipt.heic", size: 14.2 * 1024 * 1024 }) });
    const api = fakeApi();
    await engineWith(api.transport).run();
    expect(api.calls).toHaveLength(0);
    expect(outbox.get(item.id)?.error).toBe("Didn't send: the receipt photo is over 10 MB.");
  });

  it("keeps everything when the app must be updated (426), and says so", async () => {
    const item = await queuePhotos();
    const api = fakeApi();
    api.fail(1, new UpdateRequiredError("1.1.0"));
    const engine = engineWith(api.transport);
    await engine.run();
    expect(outbox.get(item.id)?.status).toBe("waiting");
    expect(engine.snapshot().problem).toBe("updateRequired");
  });

  it("records a completion someone else got to first as sent, saying who", async () => {
    const item = await queueCompletion();
    const api = fakeApi(() => ({ id: "m-9", alreadyCompleted: true, completedBy: { name: "Sarah Mendes" } }));
    await engineWith(api.transport).run();
    expect(outbox.get(item.id)).toMatchObject({ status: "sent", result: { alreadyCompleted: true, alreadyCompletedBy: "Sarah Mendes" } });
  });

  it("Fix shows the reason, the expense, and the receipt with its size over the limit", async () => {
    const item = await queueExpense({ receipt: photo(9, { name: "receipt.heic", size: 14.2 * 1024 * 1024 }) });
    await outbox.update(item.id, { status: "failed", error: "Didn't send: the receipt photo is over 10 MB." });
    renderWithSession(<FixScreen id={item.id} />);
    expect(screen.getByTestId("fix-reason").props.children).toBe("Didn't send: the receipt photo is over 10 MB.");
    expect(mockScreen.options.title).toBe("Fix expense");
    for (const text of ["Fuel & Vehicle", "$64.20", "Marina office fit-out", "Thu, Oct 8", "receipt.heic", "Retake photo", "Choose a different photo", "Remove photo", "Send again", "Delete this expense"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByTestId("fix-photo-size").props.children).toEqual(["14.2 MB", " · over the 10 MB limit"]);
  });

  it("Fix: retake or remove the photo, then send again", async () => {
    const item = await queueExpense({ receipt: photo(9, { size: 14.2 * 1024 * 1024 }) });
    await outbox.update(item.id, { status: "failed", error: "Didn't send: the receipt photo is over 10 MB." });
    pickPhoto.mockResolvedValueOnce(photo(10, { name: "retaken.jpg", size: 800_000 }));
    renderWithSession(<FixScreen id={item.id} />);
    fireEvent.press(screen.getByTestId("fix-retake"));
    await waitFor(() => expect(outbox.get(item.id)?.kind === "expense" && (outbox.get(item.id)?.payload as { receipt: { name: string } }).receipt.name).toBe("retaken.jpg"));
    expect(pickPhoto).toHaveBeenCalledWith("camera");
    expect(discardedFiles).toContain(photo(9).uri);

    fireEvent.press(screen.getByTestId("fix-remove-photo"));
    await waitFor(() => expect((outbox.get(item.id)?.payload as { receipt: unknown }).receipt).toBeNull());

    const { syncEngine } = jest.requireActual("../lib/outbox/sync-engine") as { syncEngine: SyncEngine };
    const resend = jest.spyOn(syncEngine, "resend").mockResolvedValue();
    await act(async () => fireEvent.press(screen.getByTestId("fix-send-again")));
    expect(resend).toHaveBeenCalledWith(item.id);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("Fix: delete this expense after confirming; on Android it's the bin in the top bar", async () => {
    const item = await queueExpense();
    await outbox.update(item.id, { status: "failed", error: "Didn't send: choose a category." });
    Platform.OS = "android";
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    renderWithSession(<FixScreen id={item.id} />);
    const right = (mockScreen.options.headerRight as () => React.ReactElement<{ accessibilityLabel: string; onPress: () => void }>)();
    expect(right.props.accessibilityLabel).toBe("Delete this expense");
    right.props.onPress();
    const buttons = alert.mock.calls[0]![2]!;
    expect(buttons.map((b) => b.text)).toEqual(["Cancel", "Delete"]);
    await act(async () => buttons[1]!.onPress!());
    await waitFor(() => expect(outbox.get(item.id)).toBeUndefined());
  });

  it("resend puts a fixed item back in line and sends it now", async () => {
    const item = await queueExpense({ receipt: null });
    await outbox.update(item.id, { status: "failed", error: "Didn't send: choose a category.", nextAttemptAt: NOW + 60_000 });
    const api = fakeApi();
    await engineWith(api.transport).resend(item.id);
    expect(outbox.get(item.id)).toMatchObject({ status: "sent", error: null });
  });

  it("needs fixing, not endless retries, when the phone has lost a photo's copy", async () => {
    const item = await queuePhotos("job-marina", "Marina office fit-out", 1);
    missingFiles.add(photo(0).uri);
    const api = fakeApi();
    await engineWith(api.transport).run();
    expect(api.calls).toHaveLength(0);
    expect(outbox.get(item.id)).toMatchObject({ status: "failed", error: "Didn't send: a photo is no longer on this phone. Take it again or remove it." });
  });
});
