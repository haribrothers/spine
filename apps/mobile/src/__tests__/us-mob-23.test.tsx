import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { mockRouter } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { EXPENSES, freezeClock, HOTEL, MARINA, routeRequests, TOWNHOMES } from "../test-utils/fixtures";
import { NO_RESULTS_HINT, SEARCH_HINT, SearchScreen } from "../features/search/search-screen";
import { highlightParts, searchCache } from "../lib/search/search";
import { addRecentSearch, getRecentSearches } from "../lib/search/recent-searches";
import { JOBS_PATH } from "../lib/data/jobs";
import { MY_EXPENSES_PATH } from "../lib/data/expenses";
import type { SessionContextValue } from "../lib/session/session-provider";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
    __store: store,
  };
});

const asRequest = (fn: jest.Mock) => fn as unknown as SessionContextValue["request"];
const ROUTES = { "/org/modules": { leadsMeetings: true, jobsField: true, approvals: true, recurring: true }, [JOBS_PATH]: [MARINA, TOWNHOMES, HOTEL], [MY_EXPENSES_PATH]: EXPENSES };

describe("US-MOB-23 · search my jobs and my expenses", () => {
  beforeEach(() => {
    freezeClock();
    mockRouter.push.mockClear();
    (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  });
  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = "ios";
  });

  it("matches jobs by name, customer, job number or address and my expenses by category, description or job — ignoring case and accents", () => {
    const search = (query: string, jobsOn = true) => searchCache({ query, jobs: [MARINA, TOWNHOMES, HOTEL], expenses: EXPENSES, jobsOn });
    expect(search("marina").jobs.map((j) => j.id)).toEqual([MARINA.id]);
    expect(search("marina").expenses.map((e) => e.expense.id)).toEqual(["e-1", "e-2"]);
    expect(search("MAPLE").jobs.map((j) => j.id)).toEqual([TOWNHOMES.id]);
    expect(search("job-003").jobs.map((j) => j.id)).toEqual([HOTEL.id]);
    expect(search("ridge rd").jobs.map((j) => j.id)).toEqual([TOWNHOMES.id]);
    expect(search("fuel").expenses.map((e) => e.expense.id)).toEqual(["e-1"]);
    expect(search("cafe").expenses.map((e) => e.expense.id)).toEqual(["e-3"]);
    expect(search("marina", false).jobs).toEqual([]);
    expect(search("marina", false).expenses).toEqual([]);
  });

  it("highlights the matching text, keeping the original characters", () => {
    expect(highlightParts("Marina office fit-out", "marina")).toEqual([{ text: "Marina", match: true }, { text: " office fit-out", match: false }]);
    expect(highlightParts("Café supplies", "cafe")).toEqual([{ text: "Café", match: true }, { text: " supplies", match: false }]);
  });

  it("keeps up to 10 recent searches, newest first, on this phone", async () => {
    for (let i = 1; i <= 12; i++) await addRecentSearch(`query ${i}`);
    await addRecentSearch("Query 5");
    const recent = await getRecentSearches();
    expect(recent).toHaveLength(10);
    expect(recent[0]).toBe("Query 5");
    expect(recent.filter((q) => q.toLowerCase() === "query 5")).toHaveLength(1);
  });

  it("opens with the hint and my recent searches, with Clear on Android", async () => {
    await addRecentSearch("fuel");
    await addRecentSearch("marina");
    Platform.OS = "android";
    renderWithSession(<SearchScreen />, { request: asRequest(routeRequests(ROUTES)) });
    expect(await screen.findByText("Recent searches")).toBeTruthy();
    expect(screen.getByText(SEARCH_HINT)).toBeTruthy();
    expect(screen.getByTestId("search-recent-0")).toBeTruthy();
    expect(within(screen.getByTestId("search-recent-action")).getByText("Clear")).toBeTruthy();
    fireEvent.press(screen.getByTestId("search-recent-action"));
    await waitFor(() => expect(screen.queryByText("Recent searches")).toBeNull());
  });

  it("offers Edit on iOS to remove a recent search", async () => {
    await addRecentSearch("fuel");
    renderWithSession(<SearchScreen />, { request: asRequest(routeRequests(ROUTES)) });
    fireEvent.press(await screen.findByText("Edit"));
    fireEvent.press(screen.getByLabelText("Remove fuel"));
    await waitFor(() => expect(screen.queryByText("fuel")).toBeNull());
  });

  it("groups results as Jobs · <n> and Your expenses · <n>, and opens a result in its tab, remembering the search", async () => {
    Platform.OS = "android";
    renderWithSession(<SearchScreen />, { request: asRequest(routeRequests(ROUTES)) });
    await waitFor(() => expect(screen.getByTestId("search-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("search-input"), "marina");
    expect(await screen.findByText("Jobs · 1")).toBeTruthy();
    expect(screen.getByText("Your expenses · 2")).toBeTruthy();
    expect(screen.getAllByTestId("search-highlight").length).toBeGreaterThan(0);
    expect(screen.getByText("$64.20")).toBeTruthy();
    fireEvent.press(screen.getByTestId(`search-job-${MARINA.id}`));
    expect(mockRouter.push).toHaveBeenCalledWith(`/jobs/${MARINA.id}`);
    await waitFor(async () => expect(await getRecentSearches()).toEqual(["marina"]));
    fireEvent.press(screen.getByTestId("search-expense-e-2"));
    expect(mockRouter.push).toHaveBeenCalledWith("/expenses/e-2");
  });

  it("leaves out a group with no matches, and says so when nothing matches", async () => {
    Platform.OS = "android";
    renderWithSession(<SearchScreen />, { request: asRequest(routeRequests(ROUTES)) });
    await waitFor(() => expect(screen.getByTestId("search-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("search-input"), "maple");
    expect(await screen.findByText("Jobs · 1")).toBeTruthy();
    expect(screen.queryByText(/Your expenses/)).toBeNull();
    fireEvent.changeText(screen.getByTestId("search-input"), "zebra");
    expect(await screen.findByText("No results for “zebra”")).toBeTruthy();
    expect(screen.getByText(NO_RESULTS_HINT)).toBeTruthy();
  });

  it("searches the phone's cache when offline", async () => {
    const online = routeRequests(ROUTES);
    Platform.OS = "android";
    const first = renderWithSession(<SearchScreen />, { request: asRequest(online) });
    await waitFor(() => expect(online).toHaveBeenCalledWith("GET", MY_EXPENSES_PATH));
    first.unmount();
    const { OfflineError } = jest.requireActual("../lib/api/errors");
    const offline = jest.fn(async () => {
      throw new OfflineError();
    });
    renderWithSession(<SearchScreen />, { request: asRequest(offline) });
    fireEvent.changeText(screen.getByTestId("search-input"), "fuel");
    expect(await screen.findByText("Your expenses · 1")).toBeTruthy();
  });

  it("never shows other people's expenses, unassigned jobs or invoices: it only searches the caller's own feeds", () => {
    expect(JOBS_PATH).toContain("assignedToMe=true");
    expect(MY_EXPENSES_PATH).toBe("/expenses?mine=true");
  });

  it("searches only my expenses when Jobs & field is off", async () => {
    Platform.OS = "android";
    renderWithSession(<SearchScreen />, { request: asRequest(routeRequests({ ...ROUTES, "/org/modules": { leadsMeetings: true, jobsField: false, approvals: true, recurring: true } })) });
    await waitFor(() => expect(screen.getByTestId("search-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("search-input"), "marina");
    await waitFor(() => expect(screen.getByText("No results for “marina”")).toBeTruthy());
    expect(screen.queryByText(/Jobs ·/)).toBeNull();
  });
});
