import { act, fireEvent, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { mockRouter, mockScreen } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { MARINA, MILESTONES } from "../test-utils/fixtures";
import { discardedFiles, photo } from "../test-utils/outbox";
import { cache } from "../lib/cache/cache-store";
import { outbox } from "../lib/outbox/outbox";
import { cameraHandoff } from "../lib/camera/handoff";
import { JOBS_KEY, milestonesKey } from "../lib/data/jobs";
import { COMPLETE_NOTE, MilestoneCompleteScreen } from "../features/jobs/milestone-complete-screen";

describe("US-MOB-15 · mark a milestone complete from the phone", () => {
  beforeEach(async () => {
    mockRouter.push.mockClear();
    mockRouter.back.mockClear();
    await cache.write(JOBS_KEY, [MARINA]);
    await cache.write(milestonesKey(MARINA.id), MILESTONES);
  });
  afterEach(() => {
    Platform.OS = "ios";
  });

  it("shows the milestone and job, PHOTOS OF THE FINISHED WORK, NOTE FOR THE OFFICE (OPTIONAL), the note and Mark complete", async () => {
    renderWithSession(<MilestoneCompleteScreen jobId={MARINA.id} milestoneId="m-1" />);
    expect(await screen.findByText("Mobilisation & site setup")).toBeTruthy();
    expect(screen.getByText("Marina office fit-out · due Sat, Oct 10")).toBeTruthy();
    expect(screen.getByText("PHOTOS OF THE FINISHED WORK")).toBeTruthy();
    expect(screen.getByText("NOTE FOR THE OFFICE (OPTIONAL)")).toBeTruthy();
    expect(screen.getByText(COMPLETE_NOTE)).toBeTruthy();
    expect(COMPLETE_NOTE).toBe("Your office is told straight away so they can bill this stage. No signal? It's saved and sent when you're back online.");
    expect(mockScreen.options.title).toBe("Mark complete");
    expect(screen.getByText("Mark complete")).toBeTruthy();
  });

  it("shows the note as a Material outlined field on Android", async () => {
    Platform.OS = "android";
    renderWithSession(<MilestoneCompleteScreen jobId={MARINA.id} milestoneId="m-1" />);
    expect(await screen.findByText("Note for the office (optional)")).toBeTruthy();
    const note = screen.getByTestId("milestone-note");
    expect(note.props.accessibilityLabel).toBe("Note for the office (optional)");
    expect(note.props.multiline).toBe(true);
    expect(screen.queryByText("NOTE FOR THE OFFICE (OPTIONAL)")).toBeNull();
  });

  it("adds photos from the camera and puts the completion, note and photos in the outbox", async () => {
    renderWithSession(<MilestoneCompleteScreen jobId={MARINA.id} milestoneId="m-1" />);
    await screen.findByText("Mobilisation & site setup");
    fireEvent.press(screen.getByTestId("milestone-add-photo"));
    const url = mockRouter.push.mock.calls[0]![0] as string;
    expect(url).toMatch(new RegExp(`^/camera\\?mode=milestone&jobId=${MARINA.id}&request=`));
    const request = url.split("request=")[1]!;
    act(() => cameraHandoff.deliver(request, [photo(1), photo(2)]));
    expect(screen.getAllByLabelText("Photo of the finished work")).toHaveLength(2);
    fireEvent.changeText(screen.getByTestId("milestone-note"), "Site cabin, fencing and temporary power in place.");
    await act(async () => fireEvent.press(screen.getByTestId("milestone-complete-submit")));
    const [item] = outbox.snapshot();
    expect(item).toMatchObject({ kind: "completion", status: "waiting", payload: { jobId: MARINA.id, milestoneId: "m-1", milestoneName: "Mobilisation & site setup", completionNotes: "Site cabin, fencing and temporary power in place." } });
    expect(item!.kind === "completion" && item!.payload.photos).toHaveLength(2);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("deletes the photos from the phone when cancelled", async () => {
    Platform.OS = "android";
    renderWithSession(<MilestoneCompleteScreen jobId={MARINA.id} milestoneId="m-1" />);
    await screen.findByText("Mobilisation & site setup");
    fireEvent.press(screen.getByTestId("milestone-add-photo"));
    const request = (mockRouter.push.mock.calls[0]![0] as string).split("request=")[1]!;
    act(() => cameraHandoff.deliver(request, [photo(3)]));
    expect(mockScreen.options.title).toBe("Mark complete?");
    fireEvent.press(screen.getByText("Cancel"));
    expect(discardedFiles).toEqual([photo(3).uri]);
    expect(outbox.snapshot()).toHaveLength(0);
  });
});
