import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";
import { mockRouter } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { freezeClock, MARINA, MILESTONES } from "../test-utils/fixtures";
import { queuePhotos } from "../test-utils/outbox";
import { outbox } from "../lib/outbox/outbox";
import { connectivity } from "../lib/connectivity";
import { ApiError } from "../lib/api/errors";
import type { JobPhoto } from "../lib/data/jobs";
import { PhotoViewerScreen } from "../features/jobs/photo-viewer-screen";
import type { SessionContextValue } from "../lib/session/session-provider";

const id = MARINA.id;
const MINE: JobPhoto = { id: "p-mine", fileId: "f-mine", caption: "Wrong site", milestoneId: null, createdAt: "2026-10-08T16:38:00.000Z", uploadedByName: "Marcus Webb", canDelete: true, locked: false };
const THEIRS: JobPhoto = { id: "p-theirs", fileId: "f-theirs", caption: "Gate north", milestoneId: null, createdAt: "2026-10-07T09:00:00.000Z", uploadedByName: "Ravi Kumar", canDelete: false, locked: false };
const LOCKED: JobPhoto = { id: "p-locked", fileId: "f-locked", caption: "Roof trusses", milestoneId: "m-0", createdAt: "2026-10-06T09:00:00.000Z", uploadedByName: "Ravi Kumar", canDelete: true, locked: true };

/** GETs from the fixtures; DELETEs answered by `onDelete`. */
function api(rows: JobPhoto[], onDelete: (path: string, body: unknown) => unknown = () => ({ id: "x" })) {
  return jest.fn(async (method: string, path: string, options?: { body?: unknown }) => {
    if (method === "DELETE") return onDelete(path, options?.body);
    if (path === `/jobs/${id}/photos`) return rows;
    if (path === `/jobs/${id}/milestones`) return MILESTONES;
    throw new Error(`No fixture for ${path}`);
  });
}
const asRequest = (fn: jest.Mock) => fn as unknown as SessionContextValue["request"];
/** Presses the alert's button with this text. */
const pressAlert = (text: string) => {
  const buttons = (jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? []) as AlertButton[];
  act(() => buttons.find((b) => b.text === text)?.onPress?.());
};

describe("US-MOB-31 · delete a photo from the phone", () => {
  beforeEach(() => {
    freezeClock();
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    mockRouter.back.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    connectivity.set(true);
  });

  it("offers Delete photo only on a photo the person may delete", async () => {
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="p-theirs" />, { request: asRequest(api([MINE, THEIRS])) });
    expect(await screen.findByText("2 of 2")).toBeTruthy();
    expect(screen.queryByTestId("photo-viewer-delete")).toBeNull();
    // The photo itself renders once its file address has loaded, after the counter.
    fireEvent(await screen.findByLabelText("Photo 2 of 2"), "accessibilityAction", { nativeEvent: { actionName: "previous" } });
    expect(await screen.findByTestId("photo-viewer-delete")).toBeTruthy();
  });

  it("asks first, deletes straight away (not through the outbox), says 'Photo deleted' and shows the next photo", async () => {
    const request = api([MINE, THEIRS]);
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="p-mine" />, { request: asRequest(request) });
    fireEvent.press(await screen.findByTestId("photo-viewer-delete"));
    expect(Alert.alert).toHaveBeenCalledWith("Delete this photo?", "It's removed from the job and deleted from storage.", expect.any(Array));
    const buttons = (jest.mocked(Alert.alert).mock.calls[0]![2] ?? []) as AlertButton[];
    expect(buttons.map((b) => [b.text, b.style])).toEqual([
      ["Cancel", "cancel"],
      ["Delete photo", "destructive"],
    ]);
    expect(request).not.toHaveBeenCalledWith("DELETE", expect.anything(), expect.anything());

    pressAlert("Delete photo");
    await waitFor(() => expect(request).toHaveBeenCalledWith("DELETE", `/jobs/${id}/photos/p-mine`, expect.objectContaining({ body: {} })));
    expect(outbox.snapshot()).toHaveLength(0);
    expect(await screen.findByText("Photo deleted")).toBeTruthy();
    expect(await screen.findByText("1 of 1")).toBeTruthy();
    expect(within(screen.getByTestId("photo-viewer-details")).getByText("Gate north")).toBeTruthy();
  });

  it("closes the viewer when the last photo is deleted", async () => {
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="p-mine" />, { request: asRequest(api([MINE])) });
    fireEvent.press(await screen.findByTestId("photo-viewer-delete"));
    pressAlert("Delete photo");
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it("offline, Delete photo is dimmed with 'Connect to delete this photo.' and nothing is queued", async () => {
    const request = api([MINE]);
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="p-mine" />, { request: asRequest(request) });
    await screen.findByTestId("photo-viewer-delete");
    act(() => connectivity.set(false));
    const button = screen.getByTestId("photo-viewer-delete");
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText("Connect to delete this photo.")).toBeTruthy();
    fireEvent.press(button);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(outbox.snapshot()).toHaveLength(0);
  });

  it("discards a photo waiting to send from the phone, after 'Discard this photo?'", async () => {
    const item = await queuePhotos(id, MARINA.name, 2);
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="file:///outbox/photo-0.jpg" />, { request: asRequest(api([])) });
    fireEvent.press(await screen.findByTestId("photo-viewer-discard"));
    expect(Alert.alert).toHaveBeenCalledWith("Discard this photo?", "It hasn't been sent yet. Discarding deletes it from this phone.", expect.any(Array));
    pressAlert("Discard");
    const left = () => {
      const queued = outbox.get(item.id);
      return queued && queued.kind === "photos" ? queued.payload.photos.map((p) => p.uri) : [];
    };
    await waitFor(() => expect(left()).toEqual(["file:///outbox/photo-1.jpg"]));
    expect(await screen.findByText("Photo discarded")).toBeTruthy();

    // The last one takes its outbox item with it.
    fireEvent.press(await screen.findByTestId("photo-viewer-discard"));
    pressAlert("Discard");
    await waitFor(() => expect(outbox.get(item.id)).toBeUndefined());
  });

  it("an Owner deleting a locked photo gives a reason, which is sent with it", async () => {
    const request = api([LOCKED]);
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="p-locked" />, { request: asRequest(request) });
    fireEvent.press(await screen.findByTestId("photo-viewer-delete"));
    const sheet = await screen.findByTestId("photo-reason-sheet");
    expect(within(sheet).getByText("Delete a locked photo?")).toBeTruthy();
    expect(screen.getByTestId("photo-reason-delete").props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.changeText(screen.getByTestId("photo-reason"), "Shows the neighbour's house");
    fireEvent.press(screen.getByTestId("photo-reason-delete"));
    await waitFor(() => expect(request).toHaveBeenCalledWith("DELETE", `/jobs/${id}/photos/p-locked`, expect.objectContaining({ body: { reason: "Shows the neighbour's house" } })));
  });

  it("says why when the photo was locked or deleted meanwhile, and refreshes the photos", async () => {
    const request = api([MINE], () => {
      throw new ApiError("This photo can't be deleted any more: the milestone is invoiced. Ask an Owner.", 409, "PHOTO_LOCKED");
    });
    renderWithSession(<PhotoViewerScreen jobId={id} startKey="p-mine" />, { request: asRequest(request) });
    fireEvent.press(await screen.findByTestId("photo-viewer-delete"));
    const gets = request.mock.calls.filter(([method]) => method === "GET").length;
    pressAlert("Delete photo");
    await waitFor(() => expect(Alert.alert).toHaveBeenLastCalledWith("The photo couldn't be deleted. Try again.", "This photo can't be deleted any more: the milestone is invoiced. Ask an Owner."));
    await waitFor(() => expect(request.mock.calls.filter(([method]) => method === "GET").length).toBeGreaterThan(gets));
  });
});
