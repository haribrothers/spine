import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { mockTakePicture } from "../test-utils/camera-mock";
import { mockRouter } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { MARINA, MILESTONES, TOWNHOMES } from "../test-utils/fixtures";
import { discardedFiles } from "../test-utils/outbox";
import { cache } from "../lib/cache/cache-store";
import { outbox } from "../lib/outbox/outbox";
import { JOBS_KEY, milestonesKey } from "../lib/data/jobs";
import { CameraScreen, takenLabel } from "../features/camera/camera-screen";
import { REVIEW_NOTE, saveLabel } from "../features/camera/photo-review";
import type { SessionContextValue } from "../lib/session/session-provider";

const offline = jest.fn(async () => {
  throw new (jest.requireActual("../lib/api/errors").OfflineError)();
}) as unknown as SessionContextValue["request"];

async function shoot(times: number) {
  for (let i = 0; i < times; i++) await act(async () => fireEvent.press(screen.getByTestId("camera-shutter")));
}

describe("US-MOB-11 · take site photos tagged to a job, even offline", () => {
  beforeEach(async () => {
    mockRouter.back.mockClear();
    mockTakePicture.mockClear();
    await cache.write(JOBS_KEY, [MARINA, TOWNHOMES]);
    await cache.write(milestonesKey(MARINA.id), MILESTONES);
  });
  afterEach(() => jest.restoreAllMocks());

  it("opens the camera with the job at the top (changeable), flash, shutter and Done", async () => {
    renderWithSession(<CameraScreen mode="photos" jobId={MARINA.id} />, { request: offline });
    expect(await screen.findByText("Marina office fit-out")).toBeTruthy();
    expect(screen.getByTestId("camera-flash").props.accessibilityLabel).toBe("Flash off");
    fireEvent.press(screen.getByTestId("camera-flash"));
    expect(screen.getByTestId("camera-flash").props.accessibilityLabel).toBe("Flash on");
    expect(screen.getByTestId("camera-done")).toBeTruthy();
    fireEvent.press(screen.getByTestId("camera-job"));
    fireEvent.press(screen.getByTestId(`picker-option-${TOWNHOMES.id}`));
    expect(screen.getByText(TOWNHOMES.name)).toBeTruthy();
  });

  it("counts what's taken and saved on the phone, with the latest thumbnail and its count", async () => {
    renderWithSession(<CameraScreen mode="photos" jobId={MARINA.id} />, { request: offline });
    await screen.findByText("Marina office fit-out");
    await shoot(2);
    expect(mockTakePicture).toHaveBeenCalledTimes(2);
    expect(screen.getByText(takenLabel(2))).toBeTruthy();
    expect(takenLabel(2)).toBe("2 taken · saved on this phone");
    expect(screen.getByLabelText("2 photos taken")).toBeTruthy();
  });

  it("reviews them after Done: a caption per photo, the job, an optional milestone, then Save <n> photos into the outbox", async () => {
    renderWithSession(<CameraScreen mode="photos" jobId={MARINA.id} />, { request: offline });
    await screen.findByText("Marina office fit-out");
    await shoot(2);
    fireEvent.press(screen.getByTestId("camera-done"));
    expect(await screen.findByText("2 photos")).toBeTruthy();
    expect(screen.getByText(REVIEW_NOTE)).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("review-caption"), "Site cabin in place");
    fireEvent.press(screen.getByTestId("review-thumb-1"));
    fireEvent.changeText(screen.getByTestId("review-caption"), "Fencing");
    await act(async () => screen.UNSAFE_getByProps({ testID: "review-milestone" }).props.onValueChange("m-1"));
    expect(screen.UNSAFE_getByProps({ testID: "review-milestone" }).props.options.map((o: { label: string }) => o.label)).toEqual(["No milestone", "Mobilisation & site setup", "Framing & rough-in complete"]);
    expect(saveLabel(2)).toBe("Save 2 photos");
    await act(async () => fireEvent.press(screen.getByText("Save 2 photos")));
    const [item] = outbox.snapshot();
    expect(item).toMatchObject({ kind: "photos", status: "waiting", payload: { jobId: MARINA.id, jobName: MARINA.name, milestoneId: "m-1" } });
    expect(item!.kind === "photos" && item!.payload.photos.map((p) => p.caption)).toEqual(["Site cabin in place", "Fencing"]);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("asks before discarding photos taken but not saved", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    renderWithSession(<CameraScreen mode="photos" jobId={MARINA.id} />, { request: offline });
    await screen.findByText("Marina office fit-out");
    await shoot(1);
    fireEvent.press(screen.getByTestId("camera-close"));
    const buttons = alert.mock.calls[0]![2]!;
    expect(alert.mock.calls[0]![0]).toBe("Discard 1 photo?");
    act(() => buttons[1]!.onPress!());
    expect(discardedFiles).toHaveLength(1);
    expect(discardedFiles[0]).toMatch(/^file:\/\/\/camera\/shot-\d+\.jpg$/);
    expect(outbox.snapshot()).toHaveLength(0);
  });

  it("hands photos back to Mark complete in milestone mode", async () => {
    const handoff = jest.requireActual("../lib/camera/handoff") as typeof import("../lib/camera/handoff");
    const deliver = jest.spyOn(handoff.cameraHandoff, "deliver");
    renderWithSession(<CameraScreen mode="milestone" jobId={MARINA.id} request="req-1" />, { request: offline });
    await screen.findByText("Marina office fit-out");
    await shoot(1);
    fireEvent.press(screen.getByTestId("camera-done"));
    await waitFor(() => expect(deliver).toHaveBeenCalledWith("req-1", [expect.objectContaining({ mimeType: "image/jpeg" })]));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
