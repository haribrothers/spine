import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import { mockRouter, mockScreen } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { freezeClock, NOTIFICATIONS, PENDING, routeRequests } from "../test-utils/fixtures";
import { NotificationsScreen, NOTIFICATIONS_EMPTY_MESSAGE, NOTIFICATIONS_EMPTY_TITLE } from "../features/notifications/notifications-screen";
import { BellButton } from "../components/bell-button";
import { ExpenseScreen } from "../features/expenses/expense-screen";
import { MeetingScreen } from "../features/meetings/meeting-screen";
import { badgeText, NOTIFICATIONS_PATH, routeForLink, UNREAD_PATH } from "../lib/data/notifications";
import type { SessionContextValue } from "../lib/session/session-provider";

const asRequest = (fn: jest.Mock) => fn as unknown as SessionContextValue["request"];

describe("US-MOB-22 · see my notifications on the phone", () => {
  beforeEach(() => {
    freezeClock();
    mockRouter.push.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = "ios";
  });

  it("shows the unread count on Today's bell, 9+ above nine, and opens Notifications", async () => {
    expect([badgeText(0), badgeText(2), badgeText(9), badgeText(12)]).toEqual([null, "2", "9", "9+"]);
    renderWithSession(<BellButton />, { request: asRequest(routeRequests({ [UNREAD_PATH]: { count: 12 } })) });
    expect(await screen.findByText("9+")).toBeTruthy();
    expect(screen.getByTestId("today-bell").props.accessibilityLabel).toBe("Notifications, 12 unread");
    fireEvent.press(screen.getByTestId("today-bell"));
    expect(mockRouter.push).toHaveBeenCalledWith("/notifications");
  });

  it("lists NEW and EARLIER with message, detail and time; unread carry a dot on iOS", async () => {
    renderWithSession(<NotificationsScreen />, { request: asRequest(routeRequests({ [NOTIFICATIONS_PATH]: NOTIFICATIONS })) });
    expect(await screen.findByText("NEW")).toBeTruthy();
    expect(screen.getByText("EARLIER")).toBeTruthy();
    expect(screen.getByText("Sarah Mendes rejected your expense")).toBeTruthy();
    expect(screen.getByText("Fuel & Vehicle · $38.50 · “No receipt attached — please add one next time.”")).toBeTruthy();
    expect(screen.getByText("10 min ago")).toBeTruthy();
    expect(screen.getByTestId("notification-dot-n-1")).toBeTruthy();
    expect(screen.queryByTestId("notification-dot-n-3")).toBeNull();
  });

  it("tints unread rows on Android and puts the time on the right", async () => {
    Platform.OS = "android";
    renderWithSession(<NotificationsScreen />, { request: asRequest(routeRequests({ [NOTIFICATIONS_PATH]: NOTIFICATIONS })) });
    expect(await screen.findByText("New")).toBeTruthy();
    expect(screen.getByTestId("notification-n-1").props.className ?? "").toBeDefined();
    expect(screen.getByText("10m")).toBeTruthy();
    expect(screen.queryByTestId("notification-dot-n-1")).toBeNull();
  });

  it("marks one read and lands on its expense, job or meeting", async () => {
    expect(routeForLink("/expenses/e-3")).toBe("/expenses/e-3");
    expect(routeForLink("/jobs/job-townhomes")).toBe("/jobs/job-townhomes");
    expect(routeForLink("/meetings?id=meet-1")).toBe("/meetings/meet-1");
    expect(routeForLink("/quotes/q-1")).toBeNull();
    const request = routeRequests({ [NOTIFICATIONS_PATH]: NOTIFICATIONS });
    renderWithSession(<NotificationsScreen />, { request: asRequest(request) });
    fireEvent.press(await screen.findByTestId("notification-n-1"));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/expenses/e-3"));
    expect(request).toHaveBeenCalledWith("POST", "/notifications/n-1/read", expect.objectContaining({ idempotencyKey: expect.any(String) }));
    await waitFor(() => expect(screen.queryByTestId("notification-dot-n-1")).toBeNull());
  });

  it("marks every one read with Read all", async () => {
    const request = routeRequests({ [NOTIFICATIONS_PATH]: NOTIFICATIONS });
    renderWithSession(<NotificationsScreen />, { request: asRequest(request) });
    await screen.findByText("NEW");
    const [readAll] = (mockScreen.options.unstable_headerRightItems as () => { label: string; onPress: () => void }[])();
    expect(readAll!.label).toBe("Read all");
    await act(async () => readAll!.onPress());
    expect(request).toHaveBeenCalledWith("POST", "/notifications/read-all", expect.objectContaining({ idempotencyKey: expect.any(String) }));
    await waitFor(() => expect(screen.queryByText("NEW")).toBeNull());
  });

  it("says You're all caught up when there are none", async () => {
    renderWithSession(<NotificationsScreen />, { request: asRequest(routeRequests({ [NOTIFICATIONS_PATH]: [] })) });
    expect(await screen.findByText(NOTIFICATIONS_EMPTY_TITLE)).toBeTruthy();
    expect(NOTIFICATIONS_EMPTY_TITLE).toBe("You're all caught up");
    expect(screen.getByText(NOTIFICATIONS_EMPTY_MESSAGE)).toBeTruthy();
    expect(NOTIFICATIONS_EMPTY_MESSAGE).toBe("Expense decisions, crew changes and meeting invitations show up here.");
  });

  it("shows skeleton rows, not \"You're all caught up\", while the list first loads (D-201)", async () => {
    renderWithSession(<NotificationsScreen />, { request: asRequest(routeRequests({ [NOTIFICATIONS_PATH]: PENDING })) });
    expect((await screen.findByTestId("skeleton-notifications")).props.accessibilityLabel).toBe("Loading notifications");
    expect(screen.queryByText(NOTIFICATIONS_EMPTY_TITLE)).toBeNull();
  });

  it("shows the expense's and the meeting's shape while they load", async () => {
    renderWithSession(<ExpenseScreen id="e-3" />, { request: asRequest(routeRequests({ "/expenses/e-3": PENDING })) });
    expect((await screen.findByTestId("skeleton-expense")).props.accessibilityLabel).toBe("Loading the expense");
    screen.unmount();
    renderWithSession(<MeetingScreen id="meet-1" />, { request: asRequest(routeRequests({ "/meetings/meet-1": PENDING })) });
    expect(await screen.findByTestId("skeleton-meeting-detail")).toBeTruthy();
  });
});
