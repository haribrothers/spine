import { fireEvent, screen, within } from "@testing-library/react-native";
import { Linking, Platform } from "react-native";
import { mockRouter, mockScreen } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { freezeClock, MARINA, MILESTONES, PENDING, photos, QUOTES, routeRequests, THURSDAY } from "../test-utils/fixtures";
import { JobDetailScreen } from "../features/jobs/job-detail-screen";
import { JobPhotosScreen, photosByDay } from "../features/jobs/job-photos-screen";
import type { SessionContextValue } from "../lib/session/session-provider";

jest.mock("../lib/later", () => ({ arrivesLater: jest.fn() }));
const { arrivesLater } = jest.requireMock("../lib/later") as { arrivesLater: jest.Mock };

const asRequest = (fn: jest.Mock) => fn as unknown as SessionContextValue["request"];
const id = MARINA.id;
const detailRoutes = (overrides: Record<string, unknown> = {}) =>
  routeRequests({
    "/jobs?assignedToMe=true&include=next_milestone,site_contact,milestone_counts": [MARINA],
    [`/jobs/${id}`]: MARINA,
    [`/jobs/${id}/milestones`]: MILESTONES,
    [`/jobs/${id}/photos`]: photos(12),
    [`/jobs/${id}/quotes`]: QUOTES,
    ...overrides,
  });

describe("US-MOB-05 · open a job's details on site", () => {
  beforeEach(() => {
    freezeClock();
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    mockRouter.push.mockClear();
    arrivesLater.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    Platform.OS = "ios";
  });

  it("shows the job's name, number and customer, status, site address with Directions, and the contact with a call button", async () => {
    renderWithSession(<JobDetailScreen id={id} />, { request: asRequest(detailRoutes()) });
    expect(await screen.findByText("Marina office fit-out")).toBeTruthy();
    expect(screen.getByTestId("job-subtitle").props.children).toBe("JOB-001 · Harborview Construction Co.");
    expect(within(screen.getByTestId("job-status")).getByText("Active")).toBeTruthy();
    expect(screen.getByText("48 Harbor Way, Portland, ME 04101")).toBeTruthy();
    fireEvent.press(screen.getByTestId("job-directions"));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining("48%20Harbor%20Way"));
    expect(screen.getByText("Alan Reyes")).toBeTruthy();
    expect(screen.getByText("Procurement Manager")).toBeTruthy();
    fireEvent.press(screen.getByTestId("job-call"));
    expect(Linking.openURL).toHaveBeenCalledWith("tel:+12075550142");
  });

  it("lists MILESTONES, PHOTOS · <n> with See all, and QUOTES TO PRESENT with Present", async () => {
    renderWithSession(<JobDetailScreen id={id} />, { request: asRequest(detailRoutes()) });
    expect(await screen.findByText("MILESTONES")).toBeTruthy();
    expect(await screen.findByText("PHOTOS · 12")).toBeTruthy();
    expect(screen.getByText("+9")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("See all"));
    expect(mockRouter.push).toHaveBeenCalledWith(`/jobs/${id}/photos`);
    expect(screen.getByText("QUOTES TO PRESENT")).toBeTruthy();
    expect(screen.getByText("QUO-0004 · Additional electrical outlets")).toBeTruthy();
    expect(screen.getByText("Sent Oct 6 · waiting for the customer")).toBeTruthy();
    fireEvent.press(screen.getByTestId("quote-present-q-4"));
    expect(arrivesLater).toHaveBeenCalledWith("Present");
  });

  it("shows a pending milestone's due date with Mark complete, and a completed one as Completed", async () => {
    renderWithSession(<JobDetailScreen id={id} />, { request: asRequest(detailRoutes()) });
    const pending = await screen.findByTestId("milestone-m-1");
    expect(within(pending).getByText("Due Sat, Oct 10")).toBeTruthy();
    expect(within(pending).getByText("Mark complete")).toBeTruthy();
    const done = screen.getByTestId("milestone-m-0");
    expect(within(done).getAllByText(/Completed/).length).toBeGreaterThan(0);
    expect(within(done).queryByText("Mark complete")).toBeNull();
  });

  it("never shows the contract value, milestone amounts or invoices", async () => {
    renderWithSession(<JobDetailScreen id={id} />, { request: asRequest(detailRoutes({ [`/jobs/${id}`]: { ...MARINA, contractValueAmount: "4800000" } })) });
    await screen.findByText("MILESTONES");
    expect(screen.queryAllByText(/\$|48,000|Invoice/)).toHaveLength(0);
  });

  it("puts Add photos in the toolbar on iOS and in a floating button on Android", async () => {
    renderWithSession(<JobDetailScreen id={id} />, { request: asRequest(detailRoutes()) });
    await screen.findByText("MILESTONES");
    const items = (mockScreen.options.unstable_headerRightItems as () => { label: string }[])();
    expect(items.map((item) => item.label)).toEqual(["Add photos"]);
    expect(screen.queryByTestId("job-add-photos")).toBeNull();
    screen.unmount();

    Platform.OS = "android";
    renderWithSession(<JobDetailScreen id={id} />, { request: asRequest(detailRoutes()) });
    fireEvent.press(await screen.findByTestId("job-add-photos"));
    expect(mockRouter.push).toHaveBeenCalledWith(`/camera?mode=photos&jobId=${id}`);
  });

  it("opens Photos · <n> with the job name and number, grouped by day newest first", async () => {
    renderWithSession(<JobPhotosScreen id={id} />, { request: asRequest(detailRoutes()) });
    expect(await screen.findByText("Marina office fit-out · JOB-001")).toBeTruthy();
    expect(mockScreen.options.title).toBe("Photos · 12");
    const sections = photosByDay(photos(12), "en-US", THURSDAY).map((s) => s.title);
    expect(sections).toEqual(["Today", "Mon, Oct 5", "Thu, Oct 1"]);
    expect(screen.getByText("TODAY")).toBeTruthy();
  });

  it("shows the job's shape while it loads, then each section's own skeleton until it arrives (D-201)", async () => {
    const pending = { "/jobs?assignedToMe=true&include=next_milestone,site_contact,milestone_counts": [], [`/jobs/${id}`]: PENDING, [`/jobs/${id}/milestones`]: PENDING, [`/jobs/${id}/photos`]: PENDING, [`/jobs/${id}/quotes`]: PENDING };
    renderWithSession(<JobDetailScreen id={id} />, { request: asRequest(routeRequests(pending)) });
    expect((await screen.findByTestId("skeleton-heading")).props.accessibilityLabel).toBe("Loading the job");
    screen.unmount();

    renderWithSession(<JobDetailScreen id={id} />, { request: asRequest(routeRequests({ ...pending, [`/jobs/${id}`]: MARINA })) });
    expect(await screen.findByText("Marina office fit-out")).toBeTruthy();
    expect(screen.getByTestId("skeleton-milestones")).toBeTruthy();
    expect(screen.getByTestId("skeleton-photos")).toBeTruthy();
    expect(screen.getByTestId("skeleton-quotes")).toBeTruthy();
    expect(screen.getByText("PHOTOS")).toBeTruthy();
    expect(screen.queryByText("No milestones on this job yet.")).toBeNull();
  });

  it("shows a photo grid skeleton on Photos while it loads", async () => {
    renderWithSession(<JobPhotosScreen id={id} />, { request: asRequest(detailRoutes({ [`/jobs/${id}/photos`]: PENDING })) });
    expect(await screen.findByTestId("skeleton-photos")).toBeTruthy();
    expect(mockScreen.options.title).toBe("Photos");
  });
});
