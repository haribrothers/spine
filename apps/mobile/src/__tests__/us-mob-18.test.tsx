import { act, fireEvent, screen } from "@testing-library/react-native";
import { Alert, Platform } from "react-native";
import { mockRouter } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { PRESENTED } from "../test-utils/quotes";
import { MARINA, MILESTONES, photos, QUOTES, routeRequests } from "../test-utils/fixtures";
import { connectivity } from "../lib/connectivity";
import { OfflineError } from "../lib/api/errors";
import { PresentScreen } from "../features/quotes/present-screen";
import { JobDetailScreen } from "../features/jobs/job-detail-screen";
import { NEEDS_CONNECTION_MESSAGE, NEEDS_CONNECTION_TITLE, STILL_OFFLINE_NOTE } from "../features/quotes/needs-connection";
import type { SessionContextValue } from "../lib/session/session-provider";

const asRequest = (fn: jest.Mock) => fn as unknown as SessionContextValue["request"];

describe("US-MOB-18 · require a connection to accept a quote", () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    connectivity.set(true);
  });
  afterEach(() => {
    connectivity.set(true);
    Platform.OS = "ios";
    jest.restoreAllMocks();
  });

  it("offline, Present shows Quotes need a connection, why, that the rest still works offline, Try again and Back to job", async () => {
    connectivity.set(false);
    const request = jest.fn();
    const onClose = jest.fn();
    renderWithSession(<PresentScreen id="q-4" onClose={onClose} />, { request: asRequest(request) });
    expect(await screen.findByText("Quotes need a connection")).toBeTruthy();
    expect(screen.getByText(NEEDS_CONNECTION_MESSAGE)).toBeTruthy();
    expect(NEEDS_CONNECTION_MESSAGE).toBe("Accepting a quote locks the price, so it has to reach your office straight away. Move somewhere with signal or Wi-Fi, then try again.");
    expect(screen.getByText(STILL_OFFLINE_NOTE)).toBeTruthy();
    expect(STILL_OFFLINE_NOTE).toBe("Photos, expenses and milestone updates still work offline.");
    expect(request).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Back to job"));
    expect(onClose).toHaveBeenCalled();
  });

  it("opens the quote on Try again once there's signal", async () => {
    connectivity.set(false);
    const request = jest.fn(async () => PRESENTED);
    renderWithSession(<PresentScreen id="q-4" onClose={jest.fn()} />, { request: asRequest(request) });
    await screen.findByText(NEEDS_CONNECTION_TITLE);
    connectivity.set(true);
    await act(async () => fireEvent.press(screen.getByText("Try again")));
    expect(await screen.findByText("Riverstone Builders")).toBeTruthy();
    expect(screen.queryByText(NEEDS_CONNECTION_TITLE)).toBeNull();
  });

  it("treats a request that finds no network as the same screen, not an error", async () => {
    const request = jest.fn(async () => {
      throw new OfflineError();
    });
    renderWithSession(<PresentScreen id="q-4" onClose={jest.fn()} />, { request: asRequest(request) });
    expect(await screen.findByText(NEEDS_CONNECTION_TITLE)).toBeTruthy();
  });

  it("on Android, says it in an alert over the job, with Back to job and Try again", async () => {
    Platform.OS = "android";
    const alert = jest.spyOn(Alert, "alert");
    const request = routeRequests({
      "/jobs?assignedToMe=true&include=next_milestone,site_contact,milestone_counts": [MARINA],
      [`/jobs/${MARINA.id}`]: MARINA,
      [`/jobs/${MARINA.id}/milestones`]: MILESTONES,
      [`/jobs/${MARINA.id}/photos`]: photos(0),
      [`/jobs/${MARINA.id}/quotes`]: QUOTES,
    });
    renderWithSession(<JobDetailScreen id={MARINA.id} />, { request: asRequest(request) });
    const present = await screen.findByTestId("quote-present-q-4");
    connectivity.set(false);
    fireEvent.press(present);
    expect(alert).toHaveBeenCalledWith(NEEDS_CONNECTION_TITLE, `${NEEDS_CONNECTION_MESSAGE}\n\n${STILL_OFFLINE_NOTE}`, [
      { text: "Back to job", style: "cancel" },
      { text: "Try again", onPress: expect.any(Function) },
    ]);
    expect(mockRouter.push).not.toHaveBeenCalled();
    connectivity.set(true);
    const buttons = alert.mock.calls[0]![2]!;
    buttons[1]!.onPress!();
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/quote/[id]", params: { id: "q-4", jobId: MARINA.id } });
  });
});
