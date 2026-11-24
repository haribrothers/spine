import { fireEvent, screen, within } from "@testing-library/react-native";
import { mockRouter } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { freezeClock, MARINA, MILESTONES, photos, QUOTES, routeRequests } from "../test-utils/fixtures";
import { queuePhotos } from "../test-utils/outbox";
import { cache } from "../lib/cache/cache-store";
import { connectivity } from "../lib/connectivity";
import { OfflineError } from "../lib/api/errors";
import { milestonesKey, photosKey, type JobPhoto } from "../lib/data/jobs";
import { JobDetailScreen, type TilePhoto } from "../features/jobs/job-detail-screen";
import { JobPhotosScreen } from "../features/jobs/job-photos-screen";
import { PhotoViewerScreen, viewerTiles } from "../features/jobs/photo-viewer-screen";
import type { SessionContextValue } from "../lib/session/session-provider";

const id = MARINA.id;
const asRequest = (fn: jest.Mock) => fn as unknown as SessionContextValue["request"];
const SENT: JobPhoto[] = [
  { id: "p-new", fileId: "f-new", caption: "Roof trusses", milestoneId: "m-0", createdAt: "2026-10-08T16:38:00.000Z", uploadedByName: "Ravi Kumar", canDelete: false },
  { id: "p-old", fileId: "f-old", caption: null, milestoneId: null, createdAt: "2026-10-05T09:00:00.000Z", uploadedByName: "Marcus Webb", canDelete: true },
];
const routes = (photoRows: JobPhoto[] = SENT) =>
  routeRequests({
    "/jobs?assignedToMe=true&include=next_milestone,site_contact,milestone_counts": [MARINA],
    [`/jobs/${id}`]: MARINA,
    [`/jobs/${id}/milestones`]: MILESTONES,
    [`/jobs/${id}/photos`]: photoRows,
    [`/jobs/${id}/quotes`]: QUOTES,
  });

describe("US-MOB-30 · look at a job's photos full screen", () => {
  beforeEach(() => {
    freezeClock();
    mockRouter.push.mockClear();
    mockRouter.back.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    connectivity.set(true);
  });

  it("opens a photo full screen from the job and from its Photos screen; the last tile in the strip still opens Photos", async () => {
    renderWithSession(<JobDetailScreen id={id} />, { request: asRequest(routes(photos(12))) });
    fireEvent.press(await screen.findByTestId("photo-tile-p-0"));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/photo-viewer?jobId=${id}&key=p-0`);
    fireEvent.press(screen.getByTestId("photo-tile-p-3"));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/jobs/${id}/photos`);

    screen.unmount();
    renderWithSession(<JobPhotosScreen id={id} />, { request: asRequest(routes(photos(3))) });
    fireEvent.press(await screen.findByTestId("photo-tile-p-1"));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/photo-viewer?jobId=${id}&key=p-1`);
  });

  it("shows '<n> of <total>', the caption, the milestone or 'Site photo', and who added it", async () => {
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="p-new" />, { request: asRequest(routes()) });
    expect(await screen.findByText("1 of 2")).toBeTruthy();
    const details = screen.getByTestId("photo-viewer-details");
    expect(within(details).getByText("Roof trusses")).toBeTruthy();
    expect(within(details).getByText("Site survey")).toBeTruthy();
    expect(within(details).getByText(/^Added by Ravi Kumar · /)).toBeTruthy();
  });

  it("moves between photos with Next and Previous photo (VoiceOver and TalkBack), in the same order as the photo screens", async () => {
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="p-new" />, { request: asRequest(routes()) });
    await screen.findByText("1 of 2");
    // The photo itself renders once its file address has loaded, after the counter.
    const photo = await screen.findByLabelText("Photo 1 of 2");
    expect(photo.props.accessibilityActions.map((a: { label: string }) => a.label)).toEqual(["Next photo", "Previous photo"]);
    fireEvent(photo, "accessibilityAction", { nativeEvent: { actionName: "next" } });
    expect(await screen.findByText("2 of 2")).toBeTruthy();
    expect(within(screen.getByTestId("photo-viewer-details")).getByText("Site photo")).toBeTruthy();
    fireEvent(await screen.findByLabelText("Photo 2 of 2"), "accessibilityAction", { nativeEvent: { actionName: "previous" } });
    expect(await screen.findByText("1 of 2")).toBeTruthy();

    const waiting: TilePhoto = { kind: "waiting", key: "file:///outbox/photo-0.jpg", localUri: "file:///outbox/photo-0.jpg", createdAt: "2026-10-08T17:00:00.000Z", itemId: "o-1" };
    expect(viewerTiles([waiting], SENT).map((t) => (t.kind === "sent" ? t.photo.id : t.key))).toEqual(["file:///outbox/photo-0.jpg", "p-new", "p-old"]);
  });

  it("closes with Close", async () => {
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="p-new" />, { request: asRequest(routes()) });
    fireEvent.press(await screen.findByLabelText("Close"));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("shows a photo waiting to send from the phone, with 'Waiting to send' instead of who added it", async () => {
    await queuePhotos(id, MARINA.name, 1);
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="file:///outbox/photo-0.jpg" />, { request: asRequest(routes()) });
    // Opens on the tapped photo once the sent ones load: it sits between them, by when it was taken.
    expect(await screen.findByText("2 of 3")).toBeTruthy();
    const details = screen.getByTestId("photo-viewer-details");
    expect(within(details).getByText("Waiting to send")).toBeTruthy();
    expect(within(details).getByText(/^Saved on this phone · /)).toBeTruthy();
  });

  it("offline, a photo the phone hasn't kept says it will show when back online", async () => {
    await cache.write(photosKey(id), SENT);
    await cache.write(milestonesKey(id), MILESTONES);
    connectivity.set(false);
    const offline = jest.fn(async () => {
      throw new OfflineError();
    });
    // The file isn't on the phone, and can't be fetched.
    jest.requireMock("expo-file-system").File.downloadFileAsync.mockRejectedValueOnce(new OfflineError());
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="p-new" />, { request: asRequest(offline) });
    expect(await screen.findByText("1 of 2")).toBeTruthy();
    expect((await screen.findAllByText("This photo will show when you're back online.")).length).toBeGreaterThan(0);
  });

  it("has no Save or Share", async () => {
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="p-new" />, { request: asRequest(routes()) });
    await screen.findByText("1 of 2");
    expect(screen.queryByText(/^(Save|Share)/)).toBeNull();
  });
});
