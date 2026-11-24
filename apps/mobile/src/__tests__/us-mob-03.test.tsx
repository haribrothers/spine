import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Linking, Platform } from "react-native";
import { mockRouter } from "../test-utils/router-mock";
import { renderWithSession, MARCUS } from "../test-utils/session";
import { deferred, freezeClock, HOTEL, PENDING, LATER_JOB, MARINA, MEETING, ON_HOLD, routeRequests, SUMMARY, THURSDAY, TOWNHOMES } from "../test-utils/fixtures";
import { TodayScreen, todayKpis } from "../features/today/today-screen";
import { callLabel } from "../features/today/job-card";
import { SyncPill } from "../components/sync-pill";
import { isOnToday, JOBS_PATH } from "../lib/data/jobs";
import { NEXT_MEETINGS_PATH } from "../lib/data/meetings";
import { useTabHeaderOptions } from "../components/header-items";
import type { SessionContextValue } from "../lib/session/session-provider";

const WEEK = { ...SUMMARY, period: "week" as const, from: "2026-10-05", to: "2026-10-11", milestones: { done: 0, total: 2, due: 1, nextDueDate: "2026-10-10", overdue: 1, oldestOverdueDate: "2026-10-06" }, photos: { taken: 4 }, expenses: { total: "6420", count: 1, awaitingApproval: 1, currency: "USD" } };

function routes(overrides: Record<string, unknown> = {}) {
  return routeRequests({
    "/org/modules": { leadsMeetings: true, jobsField: true, approvals: true, recurring: true },
    "/mobile/today?period=month": SUMMARY,
    "/mobile/today?period=week": WEEK,
    [JOBS_PATH]: [MARINA, TOWNHOMES, HOTEL, LATER_JOB, ON_HOLD],
    [NEXT_MEETINGS_PATH]: [MEETING],
    ...overrides,
  });
}

const session = { ...MARCUS, member: { ...MARCUS.member, currency: "USD", locale: "en-US" } };
const renderToday = (request = routes()) =>
  renderWithSession(<TodayScreen />, { request: request as unknown as SessionContextValue["request"], state: { status: "signedIn", session }, lastSession: session });

describe("US-MOB-03 · see today's jobs with addresses and tap-to-call", () => {
  beforeEach(() => {
    freezeClock();
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    mockRouter.push.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("opens with the welcome card: greeting, business and date, and the milestones gauge", async () => {
    renderToday();
    const welcome = await screen.findByTestId("today-welcome");
    expect(within(welcome).getByText("Good morning, Marcus")).toBeTruthy();
    expect(within(welcome).getByText("Riverstone Builders · Thursday, October 8")).toBeTruthy();
    expect(await screen.findByText("3 of 5 done")).toBeTruthy();
    expect(screen.getByText("Milestones this month")).toBeTruthy();
  });

  it("shows the KPI cards — due, overdue, photos and my own expenses — and no other money", async () => {
    renderToday();
    expect((await screen.findByTestId("today-kpi-due")).props.accessibilityLabel).toBe("Due this month: 3, milestones · next Sat");
    expect(screen.getByTestId("today-kpi-overdue").props.accessibilityLabel).toBe("Overdue: 1, milestone · 2 days late");
    expect(screen.getByTestId("today-kpi-photos").props.accessibilityLabel).toBe("Photos: 12, taken this month");
    expect(screen.getByTestId("today-kpi-expenses").props.accessibilityLabel).toBe("My expenses: $106.20, 1 waiting for approval");
    const amounts = screen.queryAllByText(/\$/);
    expect(amounts.map((node) => node.props.children)).toEqual(["$106.20"]);
  });

  it("counts photos still waiting to sync on the photos card", () => {
    const [, , photosCard] = todayKpis(SUMMARY, 2, { currency: "USD", locale: "en-GB" }, THURSDAY);
    expect(photosCard).toMatchObject({ value: "14", trend: "taken · 2 waiting" });
  });

  it("follows the This week / This month switch with the gauge and the cards", async () => {
    const request = routes();
    renderToday(request);
    await screen.findByText("3 of 5 done");
    fireEvent(screen.getByTestId("today-period"), "onValueChange", "This week");
    expect(await screen.findByText("0 of 2 done")).toBeTruthy();
    expect(screen.getByText("Milestones this week")).toBeTruthy();
    expect(screen.getByTestId("today-kpi-due").props.accessibilityLabel).toBe("Due this week: 1, milestone · next Sat");
    expect(request).toHaveBeenCalledWith("GET", "/mobile/today?period=week");
  });

  it("has the sync pill, the bell and the avatar in Today's header", () => {
    const ios = useTabHeaderOptions("Today", "ios", { left: <SyncPill />, right: [] }) as { unstable_headerLeftItems: () => unknown[]; unstable_headerRightItems: () => unknown[] };
    expect(ios.unstable_headerLeftItems()).toHaveLength(1);
    expect(ios.unstable_headerRightItems()).toHaveLength(1);
    renderWithSession(<SyncPill />);
    expect(screen.getByText("All synced")).toBeTruthy();
  });

  it("puts Add photo and Log expense (with Scan receipt and Directions) under the KPI cards", async () => {
    renderToday();
    for (const id of ["add-photo", "log-expense", "scan-receipt", "directions"]) expect(await screen.findByTestId(`today-action-${id}`)).toBeTruthy();
  });

  it("lists only Active jobs with a milestone overdue or due within 7 days", async () => {
    expect([MARINA, TOWNHOMES, HOTEL, LATER_JOB, ON_HOLD].filter((job) => isOnToday(job, THURSDAY)).map((job) => job.id)).toEqual([MARINA.id, TOWNHOMES.id]);
    renderToday();
    expect(await screen.findByText("YOUR JOBS TODAY · 2")).toBeTruthy();
    expect(screen.queryByText(HOTEL.name)).toBeNull();
    expect(screen.queryByText(LATER_JOB.name)).toBeNull();
    expect(screen.queryByText(ON_HOLD.name)).toBeNull();
  });

  it("shows each job's customer, site address and next milestone with its due chip", async () => {
    renderToday();
    const marina = await screen.findByTestId(`today-job-${MARINA.id}`);
    expect(within(marina).getByText("Harborview Construction Co.")).toBeTruthy();
    expect(within(marina).getByText("48 Harbor Way, Portland, ME 04101")).toBeTruthy();
    expect(within(marina).getByText("Due Sat")).toBeTruthy();
    expect(within(marina).getByText("Next: Mobilisation & site setup")).toBeTruthy();
    expect(within(screen.getByTestId(`today-job-${TOWNHOMES.id}`)).getByText("2 days late")).toBeTruthy();
  });

  it("calls the job contact: full name on iOS, first name on Android", async () => {
    expect(callLabel("Alan Reyes", "ios")).toBe("Call Alan Reyes");
    expect(callLabel("Alan Reyes", "android")).toBe("Call Alan");
    renderToday();
    fireEvent.press(await screen.findByTestId(`today-job-call-${MARINA.id}`));
    expect(Linking.openURL).toHaveBeenCalledWith("tel:+12075550142");
    expect(screen.getByText(Platform.OS === "android" ? "Call Alan" : "Call Alan Reyes")).toBeTruthy();
  });

  it("opens the maps app at the site address from Directions", async () => {
    renderToday();
    fireEvent.press(await screen.findByTestId(`today-job-directions-${MARINA.id}`));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining("48%20Harbor%20Way%2C%20Portland%2C%20ME%2004101"));
  });

  it("shows my next meeting, and opens a job card in the Jobs tab", async () => {
    renderToday();
    expect(await screen.findByText("NEXT MEETING")).toBeTruthy();
    expect(screen.getByText("Progress review — Phase 2 townhomes")).toBeTruthy();
    fireEvent.press(screen.getByLabelText(`${MARINA.name}, ${MARINA.contactName}`));
    expect(mockRouter.push).toHaveBeenCalledWith(`/jobs/${MARINA.id}`);
  });

  it("hides the next meeting when there is none or Leads & meetings is off", async () => {
    renderToday(routes({ [NEXT_MEETINGS_PATH]: [] }));
    await screen.findByText("YOUR JOBS TODAY · 2");
    expect(screen.queryByText("NEXT MEETING")).toBeNull();

    const off = routes({ "/org/modules": { leadsMeetings: false, jobsField: true, approvals: true, recurring: true } });
    screen.unmount();
    renderToday(off);
    await screen.findByText("YOUR JOBS TODAY · 2");
    await waitFor(() => expect(screen.queryByText("NEXT MEETING")).toBeNull());
  });

  it("hides jobs, job tiles and job figures when Jobs & field is off (D-198)", async () => {
    renderToday(routes({ "/org/modules": { leadsMeetings: true, jobsField: false, approvals: true, recurring: true }, "/mobile/today?period=month": { ...SUMMARY, milestones: null, photos: null } }));
    expect(await screen.findByTestId("today-kpi-expenses")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/YOUR JOBS TODAY/)).toBeNull());
    expect(screen.queryByTestId("today-kpi-due")).toBeNull();
    expect(screen.queryByTestId("today-action-add-photo")).toBeNull();
    expect(screen.queryByTestId("today-action-directions")).toBeNull();
    expect(screen.getByTestId("today-action-log-expense")).toBeTruthy();
  });

  it("shows skeletons for the gauge, cards, jobs and meeting while Today's first data loads (D-201)", async () => {
    renderToday(routes({ "/mobile/today?period=month": PENDING, [JOBS_PATH]: PENDING, [NEXT_MEETINGS_PATH]: PENDING }));
    expect(await screen.findByTestId("skeleton-gauge")).toBeTruthy();
    expect(screen.getByTestId("skeleton-kpis")).toBeTruthy();
    expect(screen.getByTestId("skeleton-job-cards").props.accessibilityLabel).toBe("Loading jobs");
    expect(screen.getByTestId("skeleton-meeting")).toBeTruthy();
    expect(screen.getByText("YOUR JOBS TODAY")).toBeTruthy();
    // The quick actions don't wait for anything.
    expect(screen.getByTestId("today-action-log-expense")).toBeTruthy();
  });

  it("swaps the gauge and cards for skeletons while another period loads — never the old period's numbers", async () => {
    const week = deferred<typeof WEEK>();
    renderToday(routes({ "/mobile/today?period=week": week.promise }));
    await screen.findByText("3 of 5 done");
    fireEvent(screen.getByTestId("today-period"), "onValueChange", "This week");
    expect(await screen.findByTestId("skeleton-gauge")).toBeTruthy();
    expect(screen.getByTestId("skeleton-kpis")).toBeTruthy();
    expect(screen.queryByText("3 of 5 done")).toBeNull();
    expect(screen.queryByTestId("today-kpi-due")).toBeNull();
    // The jobs don't depend on the period: they stay.
    expect(screen.getByTestId(`today-job-${MARINA.id}`)).toBeTruthy();
    week.resolve(WEEK);
    expect(await screen.findByText("0 of 2 done")).toBeTruthy();
    expect(screen.queryByTestId("skeleton-kpis")).toBeNull();
  });

  it("shows a period it has seen before at once, from the phone, with no skeleton", async () => {
    renderToday();
    await screen.findByText("3 of 5 done");
    fireEvent(screen.getByTestId("today-period"), "onValueChange", "This week");
    await screen.findByText("0 of 2 done");
    fireEvent(screen.getByTestId("today-period"), "onValueChange", "This month");
    expect(await screen.findByText("3 of 5 done")).toBeTruthy();
    expect(screen.queryByTestId("skeleton-gauge")).toBeNull();
  });
});
