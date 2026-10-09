import { screen, waitFor } from "@testing-library/react-native";
import "../test-utils/router-mock";
import { renderWithSession, MARCUS } from "../test-utils/session";
import { freezeClock, MARINA, routeRequests, TOWNHOMES } from "../test-utils/fixtures";
import { JobsListScreen } from "../features/jobs/jobs-list-screen";
import { cache } from "../lib/cache/cache-store";
import { JOBS_PATH, jobKey, milestonesKey, photosKey, pruneJobCaches, quotesKey } from "../lib/data/jobs";
import type { SessionContextValue } from "../lib/session/session-provider";

const asRequest = (fn: jest.Mock) => fn as unknown as SessionContextValue["request"];

describe("US-JOB-16 · show field crew only their assigned jobs", () => {
  beforeEach(() => freezeClock());
  afterEach(() => jest.useRealTimers());

  it("lists exactly the jobs the server says Marcus is on, and asks for his own (assignedToMe)", async () => {
    const request = routeRequests({ [JOBS_PATH]: [MARINA, TOWNHOMES] });
    renderWithSession(<JobsListScreen />, { request: asRequest(request) });
    expect(await screen.findByTestId(`job-row-${MARINA.id}`)).toBeTruthy();
    expect(screen.getByTestId(`job-row-${TOWNHOMES.id}`)).toBeTruthy();
    expect(JOBS_PATH).toContain("assignedToMe=true");
  });

  it("drops a job he's taken off on refresh, and clears its cached copy", async () => {
    for (const key of [jobKey(TOWNHOMES.id), milestonesKey(TOWNHOMES.id), photosKey(TOWNHOMES.id), quotesKey(TOWNHOMES.id), jobKey(MARINA.id)]) await cache.write(key, { cached: true });
    const request = routeRequests({ [JOBS_PATH]: [MARINA] });
    renderWithSession(<JobsListScreen />, { request: asRequest(request) });
    await screen.findByTestId(`job-row-${MARINA.id}`);
    expect(screen.queryByTestId(`job-row-${TOWNHOMES.id}`)).toBeNull();
    await waitFor(async () => expect(await cache.keys("job:")).toEqual([jobKey(MARINA.id)]));
  });

  it("prunes exactly the jobs that left the list", async () => {
    await cache.write(jobKey("a"), {});
    await cache.write(photosKey("a"), {});
    await cache.write(jobKey("b"), {});
    await pruneJobCaches([{ ...MARINA, id: "b" }]);
    expect(await cache.keys("job:")).toEqual([jobKey("b")]);
  });

  it("shows an Owner or Staff member on no crew 'No jobs assigned to you yet'", async () => {
    const owner = { ...MARCUS, member: { ...MARCUS.member, role: "owner" } };
    renderWithSession(<JobsListScreen />, { request: asRequest(routeRequests({ [JOBS_PATH]: [] })), state: { status: "signedIn", session: owner }, lastSession: owner });
    expect(await screen.findByText("No jobs assigned to you yet")).toBeTruthy();
  });
});
