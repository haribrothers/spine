import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, ActivityIndicator, Platform } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { AI_NO_IMAGES_RECEIPT_MESSAGE, AI_UNAVAILABLE_MESSAGE, aiPausedMessage, type AiStatus, type ReceiptSuggestion } from "@spine/shared/schemas";
import { mockRouter, mockScreen } from "../test-utils/router-mock";
import { jsonResponse, MARCUS, renderWithSession } from "../test-utils/session";
import { deferred, MARINA, TOWNHOMES } from "../test-utils/fixtures";
import { missingFiles, photo, queueExpense } from "../test-utils/outbox";
import { cache } from "../lib/cache/cache-store";
import { connectivity } from "../lib/connectivity";
import { outbox } from "../lib/outbox/outbox";
import { SyncEngine } from "../lib/outbox/sync-engine";
import { RejectedError, uploadReceipt, type Transport } from "../lib/outbox/send";
import { cameraHandoff } from "../lib/camera/handoff";
import { JOBS_KEY } from "../lib/data/jobs";
import { apiRequest } from "../lib/api/request";
import { ApiError, CancelledError, OfflineError, ServerUnreachableError } from "../lib/api/errors";
import { receiptReadOffered } from "../lib/data/ai";
import { NewExpenseScreen } from "../features/expenses/new-expense-screen";
import { AI_FILLED_NOTE, enteredFields, planReceiptFill, READ_RECEIPT_OFFLINE, readFailure, receiptCurrencyNote, RECEIPT_TOO_BIG, type ExpenseDraft } from "../features/expenses/expense-form";
import type { SessionContextValue } from "../lib/session/session-provider";

const CATEGORIES = [
  { id: "cat-fuel", name: "Fuel & Vehicle", archivedAt: null, accountCode: "5100", accountName: "Vehicle" },
  { id: "cat-labour", name: "Site Labour", archivedAt: null, accountCode: "5200", accountName: "Direct Labour" },
];
const MODULES = { leadsMeetings: true, jobsField: true, approvals: true, recurring: true };
const FEATURES = { readDocuments: true, draftEmails: true, draftQuoteLines: true, bankSuggestions: true };
/** Marcus is Field: no Team right, but his own receipt by the fixed rule (D-245). */
const FIELD_STATUS: AiStatus = { canUse: false, canReadOwnReceipt: true, supportsImages: true, features: FEATURES, pausedUntil: null };
const FILE_ID = "6f4f2c3e-1d5a-4c1b-9a7e-0b8c2d3e4f50";
const DIESEL: ReceiptSuggestion = {
  merchant: "Shell Harbor Rd",
  description: "Shell Harbor Rd — diesel, 15.2 gal",
  date: "2026-10-08",
  currency: "USD",
  amount: "6420",
  taxAmount: "512",
  taxPercent: 8.67,
  taxRateId: "rate-1",
  taxLines: [],
  categoryId: "cat-fuel",
  categoryFrom: "merchant",
  merchantExpenses: 3,
  readMs: 2100,
  readAsImages: true,
};

type Call = { method: string; path: string; options: { body?: unknown; idempotencyKey?: string; timeoutMs?: number; signal?: AbortSignal; formData?: FormData } };

/** The session's `request`, answering like the API: GETs by path, POST /files with an id, POST /ai/read-document with `read`. */
function api(setup: { modules?: object; status?: AiStatus | Error; read?: (call: Call) => unknown; get?: (path: string) => unknown } = {}) {
  const calls: Call[] = [];
  const request = jest.fn(async (method: string, path: string, options: Call["options"] = {}) => {
    calls.push({ method, path, options });
    if (method === "GET") {
      const custom = setup.get?.(path);
      if (custom instanceof Error) throw custom;
      if (custom !== undefined) return custom;
      if (path === "/org/modules") return setup.modules ?? { ...MODULES, ai: true };
      if (path === "/ai/status") {
        if (setup.status instanceof Error) throw setup.status;
        return setup.status ?? FIELD_STATUS;
      }
      if (path === "/expense-categories") return CATEGORIES;
      if (path === "/expenses/labour-trades") return [];
      if (path.startsWith("/jobs")) return [MARINA, TOWNHOMES];
      throw new Error(`No fixture for ${path}`);
    }
    if (path === "/files") return { id: FILE_ID };
    if (path === "/ai/read-document") return setup.read ? setup.read({ method, path, options }) : DIESEL;
    return {};
  });
  return { request: request as unknown as SessionContextValue["request"], calls, posts: () => calls.filter((c) => c.method === "POST").map((c) => c.path) };
}

const session = { ...MARCUS, member: { ...MARCUS.member, currency: "USD", locale: "en-US" } };
function renderForm(setup: ReturnType<typeof api>, props: Parameters<typeof NewExpenseScreen>[0] = {}) {
  return renderWithSession(<NewExpenseScreen {...props} />, { request: setup.request, state: { status: "signedIn", session }, lastSession: session });
}
/** Takes the receipt photo through the camera, as US-MOB-13 does. */
function takeReceipt(n = 7) {
  fireEvent.press(screen.getByTestId(screen.queryByTestId("receipt-take") ? "receipt-take" : "receipt-retake"));
  const url = mockRouter.push.mock.calls.at(-1)![0] as string;
  act(() => cameraHandoff.deliver(url.split("request=")[1]!, [photo(n, { name: "receipt.jpg", size: 1.2 * 1024 * 1024 })]));
}
const submit = () =>
  act(async () =>
    Platform.OS === "android"
      ? (mockScreen.options.headerRight as () => React.ReactElement<{ onPress: () => void }>)().props.onPress()
      : (mockScreen.options.unstable_headerRightItems as () => { onPress: () => void }[])()[0]!.onPress(),
  );
const readButton = () => screen.getByTestId("receipt-read");
/** Waits for "Read receipt" (the AI status arrives after the first render), then presses it. */
async function pressRead() {
  const button = await screen.findByTestId("receipt-read");
  await act(async () => fireEvent.press(button));
}
const tags = () => screen.queryAllByTestId("ai-suggested");
const amountValue = () => screen.getByTestId("expense-amount").props.value as string;
const prop = (testID: string, name: string) => screen.UNSAFE_getByProps({ testID }).props[name];

type Node = ReturnType<typeof screen.UNSAFE_root.findAll>[number];
/** US-MOB-20's TalkBack check: every control says something. */
function unlabelled(): string[] {
  const spoken = (node: Node): string => {
    if (typeof node.props.accessibilityLabel === "string") return node.props.accessibilityLabel;
    return node
      .findAll((child: Node) => (child.type as unknown) === "Text")
      .flatMap((child: Node) => [child.props.children].flat(Infinity))
      .filter((part: unknown) => typeof part === "string")
      .join("");
  };
  return screen.UNSAFE_root.findAll((node: Node) => typeof node.type === "string" && node.props.accessibilityRole === "button")
    .filter((node: Node) => !spoken(node).trim())
    .map((node: Node) => String(node.props.testID ?? node.type));
}

beforeEach(async () => {
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  await cache.write(JOBS_KEY, [MARINA, TOWNHOMES]);
});
afterEach(() => {
  Platform.OS = "ios";
});

describe("US-AI-10 · fill in my expense from a receipt on the phone", () => {
  it.each(["ios", "android"] as const)("on %s: Read receipt fills Amount, Date, Category and Description, each Suggested by AI, and the expense queues with the receipt AI read", async (os) => {
    Platform.OS = os;
    const setup = api();
    renderForm(setup);
    await screen.findByText("Amount (USD)");
    takeReceipt();
    await waitFor(() => expect(readButton()).toBeTruthy());
    expect(screen.getByText("Read receipt")).toBeTruthy();
    await act(async () => fireEvent.press(readButton()));

    // The photo is uploaded first, then read.
    const [upload, read] = setup.calls.filter((c) => c.method === "POST");
    expect(upload).toMatchObject({ path: "/files", options: { idempotencyKey: expect.any(String) } });
    expect(read).toMatchObject({ path: "/ai/read-document", options: { body: { fileId: FILE_ID, target: "expense" } } });
    expect(read!.options.timeoutMs).toBeGreaterThan(30_000);

    expect(await screen.findByText(AI_FILLED_NOTE)).toBeTruthy();
    expect(amountValue()).toBe("64.20");
    expect(prop("expense-category", "value")).toBe("cat-fuel");
    expect(prop("expense-date", "value")).toEqual(new Date(2026, 9, 8));
    expect(prop("expense-description", "value")).toBe("Shell Harbor Rd — diesel, 15.2 gal");
    expect(tags()).toHaveLength(4);
    // Job and Paid by stay as they were; the phone has no tax fields.
    expect(prop("expense-job", "value")).toBe("none");
    expect(prop("expense-paid-by", "value")).toBe("Me — pay me back");
    expect(screen.getByTestId("receipt-info").props.children).toEqual(["receipt.jpg", " · ", "read by AI"]);
    expect(screen.getByText("Read again")).toBeTruthy();
    expect(unlabelled()).toEqual([]);

    // Changing a field makes it mine: its tag goes.
    fireEvent.changeText(screen.getByTestId("expense-amount"), "60.00");
    expect(tags()).toHaveLength(3);

    await submit();
    const [item] = outbox.snapshot();
    expect(item).toMatchObject({ kind: "expense", payload: { amount: "6000", categoryId: "cat-fuel", date: "2026-10-08", aiAssisted: true, receipt: { name: "receipt.jpg", fileId: FILE_ID } } });
    expect(item!.payload).not.toHaveProperty("taxAmount");
  });

  it("keeps what I entered and offers Replace my entries; Read again doesn't upload the photo again", async () => {
    const setup = api();
    renderForm(setup);
    await screen.findByText("Amount (USD)");
    fireEvent.changeText(screen.getByTestId("expense-amount"), "70");
    takeReceipt();
    await pressRead();
    await screen.findByText(AI_FILLED_NOTE);
    expect(amountValue()).toBe("70");
    expect(tags()).toHaveLength(3);
    fireEvent.press(screen.getByTestId("ai-replace-mine"));
    expect(amountValue()).toBe("64.20");
    expect(tags()).toHaveLength(4);

    await act(async () => fireEvent.press(readButton()));
    expect(setup.posts()).toEqual(["/files", "/ai/read-document", "/ai/read-document"]);
  });

  it("leaves the amount empty for a receipt in another currency, a future date and a category that isn't mine", async () => {
    const setup = api({ read: () => ({ ...DIESEL, currency: "EUR", date: "2099-01-01", categoryId: "cat-unknown" }) });
    renderForm(setup);
    await screen.findByText("Amount (USD)");
    takeReceipt();
    await pressRead();
    expect(await screen.findByText(receiptCurrencyNote("EUR", "USD"))).toBeTruthy();
    expect(amountValue()).toBe("");
    expect(prop("expense-category", "value")).toBeNull();
    expect((prop("expense-date", "value") as Date).getFullYear()).not.toBe(2099);
    expect(tags()).toHaveLength(1); // Description only.
  });

  it("offline: Read receipt shows disabled with why, and the expense queues as today", async () => {
    await cache.write("modules", { ...MODULES, ai: true });
    await cache.write("ai-status", FIELD_STATUS);
    const setup = api({ get: (path) => (path === "/org/modules" || path === "/ai/status" ? new OfflineError() : undefined) });
    renderForm(setup);
    await screen.findByText("Amount (USD)");
    act(() => connectivity.set(false));
    takeReceipt();
    await waitFor(() => expect(readButton().props.accessibilityState).toMatchObject({ disabled: true }));
    expect(screen.getByTestId("receipt-read-note").props.children).toBe(READ_RECEIPT_OFFLINE);
    expect(readButton().props.accessibilityHint).toBe(READ_RECEIPT_OFFLINE);
    fireEvent.press(readButton());
    expect(setup.posts()).toEqual([]);

    fireEvent.changeText(screen.getByTestId("expense-amount"), "64.20");
    await act(async () => screen.UNSAFE_getByProps({ testID: "expense-category" }).props.onValueChange("cat-fuel"));
    await submit();
    const [item] = outbox.snapshot();
    expect(item!.kind).toBe("expense");
    const payload = item!.payload as import("../lib/outbox/types").ExpensePayload;
    expect(payload.receipt).not.toHaveProperty("fileId");
    expect(payload).not.toHaveProperty("aiAssisted");
  });

  it("isn't offered in Labour mode", async () => {
    renderForm(api());
    await screen.findByText("Amount (USD)");
    takeReceipt();
    await screen.findByTestId("receipt-read");
    await act(async () => screen.UNSAFE_getByProps({ testID: "expense-mode" }).props.onValueChange("Headcount × day rate"));
    expect(screen.queryByTestId("receipt-read")).toBeNull();
    expect(screen.getByText("Retake receipt")).toBeTruthy();
  });

  it.each<[string, Parameters<typeof api>[0]]>([
    ["AI is off", { modules: MODULES }],
    ["the feature is off", { status: { ...FIELD_STATUS, features: { ...FEATURES, readDocuments: false } } }],
    ["Staff without Use AI features", { status: { ...FIELD_STATUS, canUse: false, canReadOwnReceipt: false } }],
    ["the model can't read images (a phone receipt is always a photo)", { status: { ...FIELD_STATUS, supportsImages: false } }],
    ["the status was refused", { status: new ApiError("The AI assistant is off.", 403, "MODULE_OFF") }],
  ])("is hidden when %s", async (_name, setup) => {
    const a = api(setup);
    renderForm(a);
    await screen.findByText("Amount (USD)");
    takeReceipt();
    await act(async () => {});
    expect(screen.queryByTestId("receipt-read")).toBeNull();
    expect(screen.getByText("Retake receipt")).toBeTruthy();
    if (setup?.modules) expect(a.calls.some((c) => c.path === "/ai/status")).toBe(false);
  });

  it("is disabled while the month's budget is used up, saying until when", async () => {
    renderForm(api({ status: { ...FIELD_STATUS, pausedUntil: "2026-11-01" } }));
    await screen.findByText("Amount (USD)");
    takeReceipt();
    await waitFor(() => expect(readButton().props.accessibilityState).toMatchObject({ disabled: true }));
    expect(screen.getByTestId("receipt-read-note").props.children).toBe(aiPausedMessage("2026-11-01"));
  });

  it("while it reads: Reading… with Cancel, the form stays usable, and a cancelled read fills nothing", async () => {
    const answer = deferred<ReceiptSuggestion>();
    const setup = api({ read: () => answer.promise });
    renderForm(setup);
    await screen.findByText("Amount (USD)");
    takeReceipt();
    await pressRead();
    expect(screen.getByText("Reading…")).toBeTruthy();
    expect(readButton().props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1);
    fireEvent.changeText(screen.getByTestId("expense-description"), "Diesel for the generator");
    const signal = setup.calls.find((c) => c.path === "/ai/read-document")!.options.signal!;
    fireEvent.press(screen.getByTestId("receipt-read-cancel"));
    expect(signal.aborted).toBe(true);
    await act(async () => answer.resolve(DIESEL));
    expect(screen.queryByText(AI_FILLED_NOTE)).toBeNull();
    expect(amountValue()).toBe("");
    expect(prop("expense-description", "value")).toBe("Diesel for the generator");
    expect(screen.getByText("Read receipt")).toBeTruthy();
  });

  it("switching to Labour mid-read stops it: nothing fills the labour expense", async () => {
    const answer = deferred<ReceiptSuggestion>();
    const setup = api({ read: () => answer.promise });
    renderForm(setup);
    await screen.findByText("Amount (USD)");
    takeReceipt();
    await pressRead();
    const signal = setup.calls.find((c) => c.path === "/ai/read-document")!.options.signal!;
    await act(async () => screen.UNSAFE_getByProps({ testID: "expense-mode" }).props.onValueChange("Headcount × day rate"));
    expect(signal.aborted).toBe(true);
    await act(async () => answer.resolve(DIESEL));
    expect(prop("expense-category", "value")).toBe("cat-labour");
    expect(tags()).toHaveLength(0);
    expect((prop("expense-date", "value") as Date).getDate()).toBe(new Date().getDate());
  });

  it("tells VoiceOver and TalkBack what happened: filled in, or that AI didn't answer", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    let attempt = 0;
    renderForm(api({ read: () => (++attempt === 1 ? Promise.reject(new ApiError(AI_UNAVAILABLE_MESSAGE, 503, "AI_UNAVAILABLE")) : DIESEL) }));
    await screen.findByText("Amount (USD)");
    takeReceipt();
    await pressRead();
    expect(announce).toHaveBeenLastCalledWith(AI_UNAVAILABLE_MESSAGE);
    expect(screen.getByTestId("receipt-read-error").props.accessibilityRole).toBe("alert");
    await act(async () => fireEvent.press(screen.getByLabelText("Try reading the receipt again")));
    expect(announce).toHaveBeenLastCalledWith(AI_FILLED_NOTE);
    announce.mockRestore();
  });

  it("losing the connection mid-read says so once, and nothing stale is left when it's back", async () => {
    renderForm(api({ read: () => Promise.reject(new OfflineError()) }));
    await screen.findByText("Amount (USD)");
    takeReceipt();
    await pressRead();
    act(() => connectivity.set(false));
    expect(screen.getAllByText(READ_RECEIPT_OFFLINE)).toHaveLength(1);
    expect(screen.queryByTestId("receipt-read-error")).toBeNull();
    act(() => connectivity.set(true));
    expect(screen.queryByText(READ_RECEIPT_OFFLINE)).toBeNull();
    expect(readButton().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it("with Reduce Motion, Reading… has no spinner", async () => {
    (useReducedMotion as jest.Mock).mockReturnValue(true);
    renderForm(api({ read: () => new Promise(() => {}) }));
    await screen.findByText("Amount (USD)");
    takeReceipt();
    await pressRead();
    expect(screen.getByText("Reading…")).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it("a retaken photo drops the read still out", async () => {
    const answer = deferred<ReceiptSuggestion>();
    renderForm(api({ read: () => answer.promise }));
    await screen.findByText("Amount (USD)");
    takeReceipt(7);
    await pressRead();
    takeReceipt(8);
    await act(async () => answer.resolve(DIESEL));
    expect(amountValue()).toBe("");
    expect(screen.getByTestId("receipt-info").props.children).toEqual(["receipt.jpg", " · ", "1.2 MB"]);
  });

  it("when AI doesn't answer: says so with Try again; a refusal says why without it", async () => {
    let attempt = 0;
    renderForm(api({ read: () => (++attempt === 1 ? Promise.reject(new ApiError(AI_UNAVAILABLE_MESSAGE, 503, "AI_UNAVAILABLE")) : DIESEL) }));
    await screen.findByText("Amount (USD)");
    takeReceipt();
    await pressRead();
    expect(screen.getByText(AI_UNAVAILABLE_MESSAGE)).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText("Try reading the receipt again")));
    expect(await screen.findByText(AI_FILLED_NOTE)).toBeTruthy();
    expect(screen.queryByTestId("receipt-read-error")).toBeNull();

    expect(readFailure(new ApiError(AI_NO_IMAGES_RECEIPT_MESSAGE, 422, "AI_NO_IMAGES"))).toEqual({ message: AI_NO_IMAGES_RECEIPT_MESSAGE, canRetry: false });
    expect(readFailure(new ServerUnreachableError())).toEqual({ message: AI_UNAVAILABLE_MESSAGE, canRetry: true });
    expect(readFailure(new OfflineError())).toEqual({ message: READ_RECEIPT_OFFLINE, canRetry: true });
    expect(readFailure(new RejectedError("The receipt photo is no longer on this phone. Take it again."))).toEqual({ message: "The receipt photo is no longer on this phone. Take it again.", canRetry: false });
  });

  it("refuses a photo over 10 MB before uploading it", async () => {
    const setup = api();
    renderForm(setup);
    await screen.findByText("Amount (USD)");
    fireEvent.press(screen.getByTestId("receipt-take"));
    const url = mockRouter.push.mock.calls.at(-1)![0] as string;
    act(() => cameraHandoff.deliver(url.split("request=")[1]!, [photo(9, { size: 11 * 1024 * 1024 })]));
    await pressRead();
    expect(screen.getByText(RECEIPT_TOO_BIG)).toBeTruthy();
    expect(setup.posts()).toEqual([]);
  });

  it("fixing a refused expense: only empty fields fill", async () => {
    const queued = await queueExpense({ description: null, receipt: photo(3, { name: "receipt.jpg" }) });
    await outbox.update(queued.id, { status: "failed", error: "Didn't send: choose a category." });
    renderForm(api(), { editId: queued.id });
    expect(await screen.findByDisplayValue("64.20")).toBeTruthy();
    await pressRead();
    await screen.findByText(AI_FILLED_NOTE);
    expect(prop("expense-description", "value")).toBe("Shell Harbor Rd — diesel, 15.2 gal");
    expect(prop("expense-date", "value")).toEqual(new Date(2026, 9, 8)); // Same day: nothing to replace.
    expect(tags()).toHaveLength(1);
  });
});

describe("US-AI-10 · sending: AI changes nothing it didn't fill", () => {
  const engines: SyncEngine[] = [];
  afterEach(() => engines.splice(0).forEach((engine) => engine.stop()));
  function fakeApi(refuse?: (call: { method: string; path: string; key?: string }) => boolean) {
    const calls: { method: string; path: string; key?: string; body?: Record<string, unknown> }[] = [];
    // Like the server: a used key answers with its first result (D-009).
    const answered = new Map<string, unknown>();
    const transport = jest.fn(async (method: string, path: string, options: { body?: Record<string, unknown>; idempotencyKey?: string } = {}) => {
      const call = { method, path, key: options.idempotencyKey, body: options.body };
      calls.push(call);
      if (refuse?.(call)) throw new ApiError("This file is already used elsewhere. Upload the receipt again to use it here.", 400);
      const stored = call.key ? answered.get(`${method} ${path} ${call.key}`) : undefined;
      if (stored) return stored;
      const answer = { id: path === "/files" ? `file-${calls.length}` : "exp-1" };
      if (call.key) answered.set(`${method} ${path} ${call.key}`, answer);
      return answer;
    }) as unknown as Transport;
    const engine = new SyncEngine(outbox, () => 1_791_500_000_000);
    engines.push(engine);
    engine.setTransport(transport);
    return { engine, calls };
  }

  it("a queued expense filled in by hand syncs exactly as before: no AI, no AI mark", async () => {
    await queueExpense();
    const { engine, calls } = fakeApi();
    await engine.run();
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /files", "POST /expenses"]);
    expect(calls[1]!.body).not.toHaveProperty("aiAssisted");
  });

  it("an expense AI filled in sends the receipt it read, without uploading it again, and says so", async () => {
    await queueExpense({ receipt: photo(7, { name: "receipt.jpg", fileId: "file-early" }), aiAssisted: true });
    const { engine, calls } = fakeApi();
    await engine.run();
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /expenses"]);
    expect(calls[0]!.body).toMatchObject({ receiptFileId: "file-early", aiAssisted: true });
  });

  it("a receipt retaken after a refusal is uploaded under its own key, so the expense gets the new photo", async () => {
    const item = await queueExpense({ receipt: photo(1, { name: "receipt.jpg" }) });
    let refusals = 1;
    const { engine, calls } = fakeApi((call) => call.path === "/expenses" && refusals-- > 0);
    await engine.run();
    expect(outbox.get(item.id)?.status).toBe("failed");
    await outbox.setReceipt(item.id, photo(2, { name: "receipt.jpg" }));
    await engine.resend(item.id);
    const uploads = calls.filter((c) => c.path === "/files");
    expect(uploads.map((c) => c.key)).toEqual([`${item.id}:file:photo-1.jpg`, `${item.id}:file:photo-2.jpg`]);
    const sent = calls.filter((c) => c.path === "/expenses").at(-1)!;
    expect(sent.body).toMatchObject({ receiptFileId: "file-3" });
    expect(outbox.get(item.id)?.status).toBe("sent");
  });

  it("nothing in the outbox ever calls AI", () => {
    const dir = join(__dirname, "../lib/outbox");
    for (const file of readdirSync(dir)) expect([file, readFileSync(join(dir, file), "utf8").includes("/ai/")]).toEqual([file, false]);
  });
});

describe("US-AI-10 · the pieces", () => {
  const fetchMock = jest.fn();
  const online = async () => true;
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("Cancel stops a request: it throws CancelledError, not offline or unreachable", async () => {
    // Like fetch: an aborted signal rejects it, at once if it already was.
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          if (init.signal!.aborted) return reject(new Error("aborted"));
          init.signal!.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const controller = new AbortController();
    const pending = apiRequest("https://x/api", "POST", "/ai/read-document", { body: {}, signal: controller.signal }, online);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(CancelledError);
    const already = new AbortController();
    already.abort();
    await expect(apiRequest("https://x/api", "POST", "/ai/read-document", { body: {}, signal: already.signal }, online)).rejects.toBeInstanceOf(CancelledError);
  });

  it("AI's own 503 and 504 keep their message; other 503s are still the server not answering", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, { error: "AI_UNAVAILABLE", message: AI_UNAVAILABLE_MESSAGE }));
    await expect(apiRequest("https://x/api", "POST", "/ai/read-document", {}, online)).rejects.toMatchObject({ status: 503, code: "AI_UNAVAILABLE", message: AI_UNAVAILABLE_MESSAGE });
    fetchMock.mockResolvedValueOnce(jsonResponse(504, { error: "AI_TIMEOUT", message: AI_UNAVAILABLE_MESSAGE }));
    await expect(apiRequest("https://x/api", "POST", "/ai/read-document", {}, online)).rejects.toMatchObject({ status: 504, code: "AI_TIMEOUT" });
    fetchMock.mockResolvedValueOnce(jsonResponse(503, {}));
    await expect(apiRequest("https://x/api", "GET", "/jobs", {}, online)).rejects.toBeInstanceOf(ServerUnreachableError);
  });

  it("uploadReceipt: once, with the outbox's own checks, its key and a long timeout", async () => {
    const transport = jest.fn(async () => ({ id: "file-9" })) as unknown as Transport;
    const signal = new AbortController().signal;
    expect(await uploadReceipt(transport, photo(1), "key-1", signal)).toMatchObject({ uri: photo(1).uri, fileId: "file-9" });
    expect(transport).toHaveBeenCalledWith("POST", "/files", expect.objectContaining({ idempotencyKey: "key-1", timeoutMs: 120_000, signal }));
    expect(await uploadReceipt(transport, photo(2, { fileId: "file-2" }), "key-2")).toMatchObject({ fileId: "file-2" });
    expect(transport).toHaveBeenCalledTimes(1);
    await expect(uploadReceipt(transport, photo(3, { size: 11 * 1024 * 1024 }), "key-3")).rejects.toBeInstanceOf(RejectedError);
    missingFiles.add(photo(4).uri);
    await expect(uploadReceipt(transport, photo(4), "key-4")).rejects.toThrow("no longer on this phone");
  });

  it("who sees Read receipt", () => {
    expect(receiptReadOffered(FIELD_STATUS)).toBe(true);
    expect(receiptReadOffered({ ...FIELD_STATUS, canReadOwnReceipt: false, canUse: true })).toBe(true);
    expect(receiptReadOffered({ ...FIELD_STATUS, canReadOwnReceipt: false })).toBe(false);
    expect(receiptReadOffered({ ...FIELD_STATUS, supportsImages: null })).toBe(true);
    expect(receiptReadOffered(null)).toBe(false);
  });

  it("the fill: a new expense's default date isn't an entry; a fixed expense's values are", () => {
    const draft: ExpenseDraft = { mode: "amount", amount: "", categoryId: null, jobId: null, date: new Date(2026, 9, 18), paidBy: "employee", description: "", receipt: null, trades: [] };
    const context = { currency: "USD", categoryIds: new Set(["cat-fuel"]), today: new Date(2026, 9, 18) };
    const fresh = planReceiptFill(draft, enteredFields(draft, false), DIESEL, context);
    expect(fresh.filled).toEqual(["amount", "category", "date", "description"]);
    expect(fresh.patch).toEqual({ amount: "64.20", categoryId: "cat-fuel", date: new Date(2026, 9, 8), description: "Shell Harbor Rd — diesel, 15.2 gal" });
    // A category deleted since the expense was queued shows as empty, so AI fills it.
    const gone = { ...draft, amount: "64.2", categoryId: "cat-gone" };
    expect(planReceiptFill(gone, enteredFields(gone, true), DIESEL, context).filled).toContain("category");
    const fixing = { ...draft, amount: "64.2", categoryId: "cat-fuel", description: "Fuel" };
    const kept = planReceiptFill(fixing, enteredFields(fixing, true), DIESEL, context);
    expect(kept.filled).toEqual([]);
    expect(kept.keptFields).toEqual(["date", "description"]);
  });
});
