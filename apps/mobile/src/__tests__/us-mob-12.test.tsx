import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Platform } from "react-native";
import { mockRouter } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { EXPENSES, freezeClock, MARINA, PENDING, routeRequests } from "../test-utils/fixtures";
import { queueExpense } from "../test-utils/outbox";
import { cache } from "../lib/cache/cache-store";
import { outbox } from "../lib/outbox/outbox";
import { JOBS_KEY } from "../lib/data/jobs";
import { MY_EXPENSES_PATH } from "../lib/data/expenses";
import { EXPENSES_EMPTY_TITLE, ExpensesScreen } from "../features/expenses/expenses-screen";
import { syncEngine } from "../lib/outbox/sync-engine";
import type { Transport } from "../lib/outbox/send";
import { useTabHeaderOptions } from "../components/header-items";
import type { SessionContextValue } from "../lib/session/session-provider";

const asRequest = (fn: jest.Mock) => fn as unknown as SessionContextValue["request"];
const WITH_REVIEWER = EXPENSES.map((e) => (e.status === "rejected" ? { ...e, reviewerName: "Sarah Mendes" } : e));

describe("US-MOB-12 · see my expenses and their status", () => {
  beforeEach(async () => {
    freezeClock();
    mockRouter.push.mockClear();
    await cache.write(JOBS_KEY, [MARINA]);
  });
  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = "ios";
  });

  it("lists WAITING TO SYNC and SUBMITTED BY YOU with category, date, job, amount and status", async () => {
    const waiting = await queueExpense();
    renderWithSession(<ExpensesScreen />, { request: asRequest(routeRequests({ [MY_EXPENSES_PATH]: WITH_REVIEWER })) });
    expect(await screen.findByText("SUBMITTED BY YOU")).toBeTruthy();
    expect(screen.getByText("WAITING TO SYNC")).toBeTruthy();
    const queued = screen.getByTestId(`expense-waiting-${waiting.id}`);
    expect(within(queued).getByText("Fuel & Vehicle")).toBeTruthy();
    expect(within(queued).getByText("$64.20")).toBeTruthy();
    expect(within(queued).getByText("Waiting")).toBeTruthy();
    const fuel = screen.getByTestId("expense-row-e-1");
    expect(within(fuel).getByText("Today · Marina office fit-out")).toBeTruthy();
    expect(within(fuel).getByText("Submitted")).toBeTruthy();
    expect(within(screen.getByTestId("expense-row-e-2")).getByText("Approved")).toBeTruthy();
    expect(within(screen.getByTestId("expense-row-e-3")).getByText("Rejected")).toBeTruthy();
  });

  it("shows a rejection's reason in red under it, with who rejected it", async () => {
    renderWithSession(<ExpensesScreen />, { request: asRequest(routeRequests({ [MY_EXPENSES_PATH]: WITH_REVIEWER })) });
    expect((await screen.findByTestId("expense-reason-e-3")).props.children).toBe("“No receipt attached — please add one next time.” — Sarah Mendes");
  });

  it("opens New expense from + beside the avatar on iOS and the floating Log expense on Android", async () => {
    const options = useTabHeaderOptions("Expenses", "ios", { right: [<></>] }) as { unstable_headerRightItems: () => unknown[] };
    expect(options.unstable_headerRightItems()).toHaveLength(2);
    Platform.OS = "android";
    renderWithSession(<ExpensesScreen />, { request: asRequest(routeRequests({ [MY_EXPENSES_PATH]: WITH_REVIEWER })) });
    fireEvent.press(await screen.findByTestId("expenses-log"));
    expect(mockRouter.push).toHaveBeenCalledWith("/expense-new");
    expect(screen.getByText("Log expense")).toBeTruthy();
  });

  it("opens a refused one in Fix, and a sent one in its detail", async () => {
    const refused = await queueExpense();
    await outbox.update(refused.id, { status: "failed", error: "Didn't send: choose a category." });
    renderWithSession(<ExpensesScreen />, { request: asRequest(routeRequests({ [MY_EXPENSES_PATH]: WITH_REVIEWER })) });
    expect(await screen.findByText("Didn't send: choose a category.")).toBeTruthy();
    fireEvent.press(screen.getByTestId(`expense-waiting-${refused.id}`));
    expect(mockRouter.push).toHaveBeenCalledWith(`/sync/fix/${refused.id}`);
    fireEvent.press(screen.getByTestId("expense-row-e-2"));
    expect(mockRouter.push).toHaveBeenCalledWith("/expenses/e-2");
  });

  it("only ever asks for my own expenses, and shows a skeleton then the empty state", async () => {
    expect(MY_EXPENSES_PATH).toBe("/expenses?mine=true");
    const first = renderWithSession(<ExpensesScreen />, { request: asRequest(routeRequests({ [MY_EXPENSES_PATH]: PENDING })) });
    expect(await screen.findByTestId("skeleton-expenses")).toBeTruthy();
    first.unmount();
    renderWithSession(<ExpensesScreen />, { request: asRequest(routeRequests({ [MY_EXPENSES_PATH]: [] })) });
    expect(await screen.findByText(EXPENSES_EMPTY_TITLE)).toBeTruthy();
  });

  it("moves an expense from WAITING TO SYNC to SUBMITTED BY YOU once it's sent", async () => {
    const item = await queueExpense({ receipt: null });
    let sent = false;
    const request = jest.fn(async () => (sent ? [{ ...EXPENSES[0]!, id: "e-new" }] : []));
    syncEngine.setTransport((async () => {
      sent = true;
      return { id: "e-new" };
    }) as unknown as Transport);
    renderWithSession(<ExpensesScreen />, { request: asRequest(request) });
    expect(await screen.findByTestId(`expense-waiting-${item.id}`)).toBeTruthy();
    await act(async () => syncEngine.run({ force: true }));
    await waitFor(() => expect(screen.getByTestId("expense-row-e-new")).toBeTruthy());
    expect(screen.queryByTestId(`expense-waiting-${item.id}`)).toBeNull();
  });
});
