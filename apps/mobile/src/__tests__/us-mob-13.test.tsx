import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { mockRouter, mockScreen } from "../test-utils/router-mock";
import { renderWithSession, MARCUS } from "../test-utils/session";
import { MARINA, routeRequests, TOWNHOMES } from "../test-utils/fixtures";
import { photo, queueExpense } from "../test-utils/outbox";
import { cache } from "../lib/cache/cache-store";
import { outbox } from "../lib/outbox/outbox";
import { cameraHandoff } from "../lib/camera/handoff";
import { JOBS_KEY } from "../lib/data/jobs";
import { NewExpenseScreen, currencySymbol } from "../features/expenses/new-expense-screen";
import { AMOUNT_ABOVE_ZERO, CHOOSE_CATEGORY, EXPENSE_NOTE, LABOUR_NOTE, parseAmount, RECEIPT_TOO_BIG, rowAmount } from "../features/expenses/expense-form";
import type { SessionContextValue } from "../lib/session/session-provider";

const CATEGORIES = [
  { id: "cat-fuel", name: "Fuel & Vehicle", archivedAt: null, accountCode: "5100", accountName: "Vehicle" },
  { id: "cat-labour", name: "Site Labour", archivedAt: null, accountCode: "5200", accountName: "Direct Labour" },
  { id: "cat-old", name: "Old", archivedAt: "2026-01-01", accountCode: "5900", accountName: "Old" },
];
const TRADES = [{ trade: "Mason", lastDayRateAmount: "22000" }];
const routes = routeRequests({
  "/org/modules": { leadsMeetings: true, jobsField: true, approvals: true, recurring: true },
  "/expense-categories": CATEGORIES,
  "/expenses/labour-trades": TRADES,
  "/jobs?assignedToMe=true&include=next_milestone,site_contact,milestone_counts": [MARINA, TOWNHOMES],
});
const session = { ...MARCUS, member: { ...MARCUS.member, currency: "USD", locale: "en-US" } };
const renderForm = (props: Parameters<typeof NewExpenseScreen>[0] = {}) =>
  renderWithSession(<NewExpenseScreen {...props} />, { request: routes as unknown as SessionContextValue["request"], state: { status: "signedIn", session }, lastSession: session });
const pick = (testID: string, value: string) => act(async () => screen.UNSAFE_getByProps({ testID }).props.onValueChange(value));

describe("US-MOB-13 · submit an expense with a receipt photo", () => {
  beforeEach(async () => {
    mockRouter.push.mockClear();
    mockRouter.back.mockClear();
    await cache.write(JOBS_KEY, [MARINA, TOWNHOMES]);
  });

  it("asks for the amount in the business currency, category, job, date, paid by, description and a receipt, with the note", async () => {
    renderForm();
    expect(await screen.findByText("Amount (USD)")).toBeTruthy();
    expect(currencySymbol("USD", "en-US")).toBe("$");
    expect(currencySymbol("INR", "en-IN")).toBe("₹");
    for (const id of ["expense-category", "expense-job", "expense-date", "expense-paid-by", "expense-description"]) expect(screen.UNSAFE_getByProps({ testID: id })).toBeTruthy();
    expect(screen.UNSAFE_getByProps({ testID: "expense-paid-by" }).props.values).toEqual(["Me — pay me back", "Company"]);
    expect(screen.UNSAFE_getByProps({ testID: "expense-category" }).props.options.map((o: { label: string }) => o.label)).toEqual(["Fuel & Vehicle", "Site Labour"]);
    expect(screen.getByText("RECEIPT")).toBeTruthy();
    expect(screen.getByText(EXPENSE_NOTE)).toBeTruthy();
    expect(EXPENSE_NOTE).toBe("Your office approves it before it's paid back. No signal? It's saved and sent later.");
  });

  it("says what's missing under the field: a category and an amount above zero", async () => {
    renderForm();
    await screen.findByText("Amount (USD)");
    const [submit] = (mockScreen.options.unstable_headerRightItems as () => { label: string; onPress: () => void }[])();
    expect(submit!.label).toBe("Submit");
    await act(async () => submit!.onPress());
    expect(screen.getByText(CHOOSE_CATEGORY)).toBeTruthy();
    expect(screen.getByText(AMOUNT_ABOVE_ZERO)).toBeTruthy();
    expect(outbox.snapshot()).toHaveLength(0);
  });

  it("puts a valid expense with its receipt in the outbox, to show under WAITING TO SYNC", async () => {
    renderForm();
    await screen.findByText("Amount (USD)");
    fireEvent.changeText(screen.getByTestId("expense-amount"), "64.20");
    await pick("expense-category", "cat-fuel");
    await pick("expense-job", MARINA.id);
    fireEvent.changeText(screen.getByTestId("expense-description"), "Diesel for the site generator");
    fireEvent.press(screen.getByTestId("receipt-take"));
    const url = mockRouter.push.mock.calls[0]![0] as string;
    expect(url).toMatch(/^\/camera\?mode=receipt&request=/);
    act(() => cameraHandoff.deliver(url.split("request=")[1]!, [photo(7, { name: "receipt.jpg", size: 1.2 * 1024 * 1024 })]));
    expect(screen.getByTestId("receipt-info").props.children).toEqual(["receipt.jpg", " · ", "1.2 MB"]);
    await act(async () => (mockScreen.options.unstable_headerRightItems as () => { onPress: () => void }[])()[0]!.onPress());
    const [item] = outbox.snapshot();
    expect(item).toMatchObject({ kind: "expense", status: "waiting", payload: { categoryId: "cat-fuel", categoryName: "Fuel & Vehicle", jobId: MARINA.id, jobName: MARINA.name, amount: "6420", currency: "USD", paidBy: "employee", description: "Diesel for the site generator", receipt: { name: "receipt.jpg" } } });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("refuses a receipt over 10 MB before it's queued", async () => {
    renderForm();
    await screen.findByText("Amount (USD)");
    fireEvent.changeText(screen.getByTestId("expense-amount"), "10");
    await pick("expense-category", "cat-fuel");
    fireEvent.press(screen.getByTestId("receipt-take"));
    const request = (mockRouter.push.mock.calls[0]![0] as string).split("request=")[1]!;
    act(() => cameraHandoff.deliver(request, [photo(8, { size: 11 * 1024 * 1024 })]));
    await act(async () => (mockScreen.options.unstable_headerRightItems as () => { onPress: () => void }[])()[0]!.onPress());
    expect(screen.getByText(RECEIPT_TOO_BIG)).toBeTruthy();
    expect(outbox.snapshot()).toHaveLength(0);
  });

  it("opens the receipt camera straight away from Scan receipt", async () => {
    renderForm({ scan: true });
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/camera\?mode=receipt&request=/)));
  });

  it("Headcount × day rate: Direct Labour preselected, trades with totals, a job required, and a past trade suggested with its day rate", async () => {
    renderForm();
    await screen.findByText("Amount (USD)");
    await act(async () => screen.UNSAFE_getByProps({ testID: "expense-mode" }).props.onValueChange("Headcount × day rate"));
    expect(screen.UNSAFE_getByProps({ testID: "expense-category" }).props.value).toBe("cat-labour");
    expect(screen.getByText("TRADES")).toBeTruthy();
    expect(screen.getByText(LABOUR_NOTE)).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("trade-name-0"), "Ma");
    fireEvent.press(await screen.findByTestId("trade-suggestion-Mason"));
    fireEvent.changeText(screen.getByTestId("trade-workers-0"), "4");
    expect(screen.getByTestId("trade-total-0").props.children).toBe("$880.00");
    fireEvent.press(screen.getByTestId("trade-add"));
    fireEvent.changeText(screen.getByTestId("trade-name-1"), "Steel fixer");
    fireEvent.changeText(screen.getByTestId("trade-workers-1"), "2");
    const submit = () => act(async () => (mockScreen.options.unstable_headerRightItems as () => { onPress: () => void }[])()[0]!.onPress());
    await submit();
    expect(screen.getByText("Labour is always for a job — choose one.")).toBeTruthy();
    expect(screen.getByText("Every row needs a trade, at least one worker and a day rate.")).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("trade-rate-1"), "260");
    await pick("expense-job", TOWNHOMES.id);
    expect(screen.getByTestId("trades-total").props.children).toBe("$1,400.00");
    await submit();
    const [item] = outbox.snapshot();
    expect(item).toMatchObject({ kind: "expense", payload: { entryMode: "labour", amount: "140000", jobId: TOWNHOMES.id, categoryId: "cat-labour", labourLines: [{ trade: "Mason", headcount: 4, dayRateAmount: "22000" }, { trade: "Steel fixer", headcount: 2, dayRateAmount: "26000" }] } });
  });

  it("parses amounts the way people type them", () => {
    expect(parseAmount("1,250.50", "USD")).toBe(125050n);
    expect(parseAmount(".5", "USD")).toBe(50n);
    expect(parseAmount("abc", "USD")).toBeNull();
    expect(rowAmount({ key: "k", trade: "Helper", headcount: "6", dayRate: "140" }, "USD")).toBe(84000n);
    expect(rowAmount({ key: "k", trade: "", headcount: "6", dayRate: "140" }, "USD")).toBeNull();
  });

  it("fixes a refused expense in the same form and sends it again (US-MOB-09)", async () => {
    const item = await queueExpense({ receipt: null });
    await outbox.update(item.id, { status: "failed", error: "Didn't send: choose a category." });
    const { syncEngine } = jest.requireActual("../lib/outbox/sync-engine") as typeof import("../lib/outbox/sync-engine");
    const resend = jest.spyOn(syncEngine, "resend").mockResolvedValue();
    renderForm({ editId: item.id });
    expect(await screen.findByDisplayValue("64.20")).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("expense-amount"), "60");
    expect(mockScreen.options.title).toBe("Fix expense");
    await act(async () => (mockScreen.options.unstable_headerRightItems as () => { onPress: () => void }[])()[0]!.onPress());
    expect(outbox.get(item.id)?.payload).toMatchObject({ amount: "6000" });
    expect(resend).toHaveBeenCalledWith(item.id);
    resend.mockRestore();
  });
});
