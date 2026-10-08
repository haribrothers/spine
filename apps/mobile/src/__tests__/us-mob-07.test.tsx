import { act, screen, waitFor, within } from "@testing-library/react-native";
import { mockRouter } from "../test-utils/router-mock";
import { MARCUS, renderWithSession } from "../test-utils/session";
import { freezeClock, MARINA, MILESTONES, photos, QUOTES, routeRequests, SUMMARY, TOWNHOMES } from "../test-utils/fixtures";
import { queueCompletion, queuePhotos } from "../test-utils/outbox";
import { cache } from "../lib/cache/cache-store";
import { outbox } from "../lib/outbox/outbox";
import { syncEngine } from "../lib/outbox/sync-engine";
import { connectivity } from "../lib/connectivity";
import { OfflineError } from "../lib/api/errors";
import { JOBS_PATH, jobKey, JOBS_KEY, milestonesKey, photosKey, quotesKey } from "../lib/data/jobs";
import { TodayScreen, offlineMessage } from "../features/today/today-screen";
import { JobDetailScreen } from "../features/jobs/job-detail-screen";
import { NEXT_MEETINGS_PATH } from "../lib/data/meetings";
import type { SessionContextValue } from "../lib/session/session-provider";
import type { Transport } from "../lib/outbox/send";

jest.mock("../lib/later", () => ({ arrivesLater: jest.fn() }));

const offline = jest.fn(async () => {
  throw new OfflineError();
}) as unknown as SessionContextValue["request"];

describe("US-MOB-07 · keep working when there's no signal", () => {
  beforeEach(() => {
    freezeClock();
    mockRouter.push.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it("says 'You're offline', what still works, and how old the saved jobs are", async () => {
    await cache.write(JOBS_KEY, [MARINA, TOWNHOMES], new Date(2026, 9, 8, 7, 42).getTime());
    await cache.write("today:month", SUMMARY);
    connectivity.set(false);
    renderWithSession(<TodayScreen />, { request: offline });
    expect(await screen.findByTestId("offline-banner")).toBeTruthy();
    expect(screen.getByText("You're offline")).toBeTruthy();
    expect(screen.getByTestId("offline-banner-text").props.children).toBe("Photos, expenses and milestone updates are saved on this phone and sync when you're back online. Showing jobs as of 7:42 AM.");
    // Today still shows what was saved.
    expect(await screen.findByTestId(`today-job-${MARINA.id}`)).toBeTruthy();
    expect(offlineMessage(null, "en-US")).toBe("Photos, expenses and milestone updates are saved on this phone and sync when you're back online.");
  });

  it("opens a job seen before from the phone: details, milestones and contact", async () => {
    await cache.write(jobKey(MARINA.id), MARINA);
    await cache.write(milestonesKey(MARINA.id), MILESTONES);
    await cache.write(photosKey(MARINA.id), photos(3));
    await cache.write(quotesKey(MARINA.id), QUOTES);
    connectivity.set(false);
    renderWithSession(<JobDetailScreen id={MARINA.id} />, { request: offline });
    expect(await screen.findByText("Marina office fit-out")).toBeTruthy();
    expect(screen.getByText("Alan Reyes")).toBeTruthy();
    expect(screen.getByText("Mobilisation & site setup")).toBeTruthy();
  });

  it("shows what's saved on the phone on the cards: '2 photos waiting', 'Completion waiting'", async () => {
    await queuePhotos(MARINA.id, MARINA.name, 2);
    await queueCompletion(TOWNHOMES.id, "m-9");
    const request = routeRequests({
      "/org/modules": { leadsMeetings: true, jobsField: true, approvals: true, recurring: true },
      "/mobile/today?period=month": SUMMARY,
      [JOBS_PATH]: [MARINA, TOWNHOMES],
      [NEXT_MEETINGS_PATH]: [],
    });
    renderWithSession(<TodayScreen />, { request: request as unknown as SessionContextValue["request"] });
    const marina = await screen.findByTestId(`today-job-${MARINA.id}`);
    expect(within(marina).getByText("2 photos waiting")).toBeTruthy();
    expect(within(marina).queryByText(/^Next:/)).toBeNull();
    expect(within(screen.getByTestId(`today-job-${TOWNHOMES.id}`)).getByText("Completion waiting")).toBeTruthy();
  });

  it("marks a milestone completed on the phone 'Completion waiting' and its photos 'Waiting' on the job", async () => {
    await cache.write(jobKey(MARINA.id), MARINA);
    await cache.write(milestonesKey(MARINA.id), MILESTONES);
    await cache.write(photosKey(MARINA.id), photos(2));
    await cache.write(quotesKey(MARINA.id), []);
    await queueCompletion(MARINA.id, "m-1");
    await queuePhotos(MARINA.id, MARINA.name, 1);
    connectivity.set(false);
    renderWithSession(<JobDetailScreen id={MARINA.id} />, { request: offline });
    expect(await screen.findByTestId("milestone-waiting-m-1")).toBeTruthy();
    expect(screen.queryByTestId("milestone-complete-m-1")).toBeNull();
    expect(screen.getByText("PHOTOS · 3")).toBeTruthy();
    expect(screen.getAllByTestId("photo-waiting")).toHaveLength(1);
  });

  it("starts sending by itself when the phone is back online, and the banner goes", async () => {
    const item = await queuePhotos(MARINA.id, MARINA.name, 1);
    const transport = jest.fn(async (_m: string, path: string) => (path === "/files" ? { id: "f-1" } : { id: "p-1" })) as unknown as Transport;
    syncEngine.setTransport(transport);
    connectivity.set(false);
    syncEngine.setOnline(false);
    const online = routeRequests({
      "/org/modules": { leadsMeetings: true, jobsField: true, approvals: true, recurring: true },
      "/mobile/today?period=month": SUMMARY,
      [JOBS_PATH]: [MARINA],
      [NEXT_MEETINGS_PATH]: [],
    });
    const request = jest.fn(async (method: string, path: string) => {
      if (!connectivity.get()) throw new OfflineError();
      return online(method, path);
    }) as unknown as SessionContextValue["request"];
    renderWithSession(<TodayScreen />, { request });
    expect(await screen.findByTestId("offline-banner")).toBeTruthy();
    await act(async () => {
      connectivity.set(true);
      syncEngine.setOnline(true);
    });
    await waitFor(() => expect(outbox.get(item.id)?.status).toBe("sent"));
    await waitFor(() => expect(screen.queryByText("You're offline")).toBeNull());
  });

  it("keeps the outbox for the person who made it: someone else signing in on the phone never sends it", async () => {
    await outbox.claim(`${MARCUS.server}|${MARCUS.member.email}`);
    await queuePhotos();
    await outbox.claim(`${MARCUS.server}|marcus.webb@riverstone.example`);
    expect(outbox.snapshot()).toHaveLength(1);
    await outbox.claim(`${MARCUS.server}|someone.else@riverstone.example`);
    expect(outbox.snapshot()).toHaveLength(0);
  });
});
