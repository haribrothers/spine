import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { TextInput } from "react-native";
import { mockRouter } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { freezeClock, HOTEL, MARINA, PENDING, routeRequests, THURSDAY, TOWNHOMES } from "../test-utils/fixtures";
import { JobsListScreen, JOBS_EMPTY_MESSAGE, JOBS_EMPTY_TITLE, JOBS_FOOTNOTE } from "../features/jobs/jobs-list-screen";
import { jobMilestoneChip } from "../features/jobs/milestone-chip";
import { JOBS_PATH } from "../lib/data/jobs";
import type { SessionContextValue } from "../lib/session/session-provider";

const asRequest = (fn: jest.Mock) => fn as unknown as SessionContextValue["request"];

describe("US-MOB-04 · browse my assigned jobs", () => {
  beforeEach(() => {
    freezeClock();
    mockRouter.push.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it("lists every job I'm on: name, customer, town and milestone status", async () => {
    renderWithSession(<JobsListScreen />, { request: asRequest(routeRequests({ [JOBS_PATH]: [MARINA, TOWNHOMES, HOTEL] })) });
    expect(await screen.findByText(/ASSIGNED TO YOU · 3|Assigned to you · 3/)).toBeTruthy();
    const marina = screen.getByTestId(`job-row-${MARINA.id}`);
    expect(within(marina).getByText("Harborview Construction Co. · Portland")).toBeTruthy();
    expect(within(marina).getByText("Milestone due Sat")).toBeTruthy();
    expect(within(screen.getByTestId(`job-row-${TOWNHOMES.id}`)).getByText("Milestone 2 days late")).toBeTruthy();
    expect(within(screen.getByTestId(`job-row-${HOTEL.id}`)).getByText("All milestones complete")).toBeTruthy();
    expect(screen.getByText(JOBS_FOOTNOTE)).toBeTruthy();
    fireEvent.press(marina);
    expect(mockRouter.push).toHaveBeenCalledWith(`/jobs/${MARINA.id}`);
  });

  it("has no search field of its own: the Search tab finds jobs", async () => {
    renderWithSession(<JobsListScreen />, { request: asRequest(routeRequests({ [JOBS_PATH]: [MARINA] })) });
    await screen.findByTestId(`job-row-${MARINA.id}`);
    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  });

  it("refreshes when I pull down", async () => {
    const request = routeRequests({ [JOBS_PATH]: [MARINA] });
    renderWithSession(<JobsListScreen />, { request: asRequest(request) });
    await screen.findByTestId(`job-row-${MARINA.id}`);
    const before = request.mock.calls.filter(([, path]) => path === JOBS_PATH).length;
    await screen.getByTestId("jobs-list").props.refreshControl.props.onRefresh();
    expect(request.mock.calls.filter(([, path]) => path === JOBS_PATH).length).toBe(before + 1);
  });

  it("says so when I'm on no jobs, with Check again", async () => {
    const request = routeRequests({ [JOBS_PATH]: [] });
    renderWithSession(<JobsListScreen />, { request: asRequest(request) });
    expect(await screen.findByText(JOBS_EMPTY_TITLE)).toBeTruthy();
    expect(JOBS_EMPTY_TITLE).toBe("No jobs assigned to you yet");
    expect(screen.getByText(JOBS_EMPTY_MESSAGE)).toBeTruthy();
    expect(JOBS_EMPTY_MESSAGE).toBe("When your office adds you to a job's crew, it shows up here with its address and contact.");
    fireEvent.press(screen.getByText("Check again"));
    await waitFor(() => expect(request.mock.calls.filter(([, path]) => path === JOBS_PATH)).toHaveLength(2));
  });

  it("shows no chip for a job without milestones yet", () => {
    expect(jobMilestoneChip({ ...HOTEL, milestoneCounts: { total: 0, completed: 0 } }, "en-US", THURSDAY)).toBeNull();
  });

  it("shows skeleton rows, not the empty state, while the list first loads (D-201)", async () => {
    renderWithSession(<JobsListScreen />, { request: asRequest(routeRequests({ [JOBS_PATH]: PENDING })) });
    expect((await screen.findByTestId("skeleton-jobs")).props.accessibilityLabel).toBe("Loading your jobs");
    expect(screen.queryByText(JOBS_EMPTY_TITLE)).toBeNull();
  });
});
