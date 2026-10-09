import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Alert, Platform, Pressable, View } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";
import "../test-utils/router-mock";
import "../test-utils/camera-mock";
import { EXPENSES, MARINA, MILESTONES, NOTIFICATIONS, photos, QUOTES, routeRequests, SUMMARY, TOWNHOMES } from "../test-utils/fixtures";
import { PRESENTED } from "../test-utils/quotes";
import { queuePhotos } from "../test-utils/outbox";
import { cache } from "../lib/cache/cache-store";
import { JOBS_KEY, JOBS_PATH, milestonesKey } from "../lib/data/jobs";
import { MY_EXPENSES_PATH } from "../lib/data/expenses";
import { NOTIFICATIONS_PATH } from "../lib/data/notifications";
import { NEXT_MEETINGS_PATH } from "../lib/data/meetings";
import { TodayScreen } from "../features/today/today-screen";
import { JobsListScreen } from "../features/jobs/jobs-list-screen";
import { JobDetailScreen } from "../features/jobs/job-detail-screen";
import { ExpensesScreen } from "../features/expenses/expenses-screen";
import { NewExpenseScreen } from "../features/expenses/new-expense-screen";
import { SearchScreen } from "../features/search/search-screen";
import { ProfileScreen } from "../features/profile/profile-screen";
import { SyncScreen } from "../features/sync/sync-screen";
import { NotificationsScreen } from "../features/notifications/notifications-screen";
import { SignInScreen } from "../features/auth/sign-in-screen";
import { MilestoneCompleteScreen } from "../features/jobs/milestone-complete-screen";
import { CameraScreen } from "../features/camera/camera-screen";
import { PresentScreen } from "../features/quotes/present-screen";
import { AcceptScreen } from "../features/quotes/accept-screen";
import { DeclineSheet } from "../features/quotes/decline-sheet";
import type { SessionContextValue } from "../lib/session/session-provider";
import { ProfileAvatarButton, useTabHeaderOptions } from "../components/header-items";
import { confirmSignOut } from "../features/profile/sign-out";
import { renderWithSession } from "../test-utils/session";

describe("US-MOB-20 · give Android users a designed Material 3 app", () => {
  it("uses a Material top app bar with the avatar on the right, not an iOS large title", () => {
    const options = useTabHeaderOptions("Jobs", "android");
    expect(options).toMatchObject({ title: "Jobs" });
    expect("headerLargeTitleEnabled" in options).toBe(false);
    expect(typeof (options as { headerRight?: unknown }).headerRight).toBe("function");
  });

  it("supports Android's predictive back gesture", () => {
    const app = JSON.parse(readFileSync(join(__dirname, "../../app.json"), "utf8")) as { expo: { android: { predictiveBackGestureEnabled: boolean } } };
    expect(app.expo.android.predictiveBackGestureEnabled).toBe(true);
  });

  it("gives icon-only controls a spoken label for TalkBack", () => {
    renderWithSession(<ProfileAvatarButton />);
    expect(screen.getByLabelText("Profile, Marcus Webb")).toBeTruthy();
  });

  it("warns with a Material dialog: Cancel, Send first, Sign out", () => {
    jest.replaceProperty(Platform, "OS", "android");
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    confirmSignOut({ photos: 2, expenses: 1, completions: 0 }, { signOut: jest.fn(), sendFirst: jest.fn() });
    const buttons = alert.mock.calls[0]![2]!;
    expect(buttons.map((button) => button.text)).toEqual(["Cancel", "Send first", "Sign out"]);
    expect(buttons[2]!.style).toBe("destructive");
    alert.mockRestore();
  });

  it("draws Android's screens as Material: title-case primary section titles, outlined Directions, floating Add photos", () => {
    const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");
    expect(read("components/section-header.tsx")).toContain('"text-[15px] font-medium text-primary dark:text-primary-dark"');
    expect(read("features/today/job-card.tsx")).toContain('outlined={Platform.OS === "android"}');
    for (const file of ["features/jobs/job-detail-screen.tsx", "features/jobs/job-photos-screen.tsx", "features/expenses/expenses-screen.tsx"]) {
      expect(read(file)).toMatch(/<Fab testID=/);
    }
    expect(read("components/fab.tsx")).toMatch(/bg-primary-container .*dark:bg-primary-container-dark/);
  });

  it("labour on Android: the trade being edited is an outlined card, the others one line each (MobExpenseLabourAndroid)", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    const request = routeRequests({
      "/org/modules": { leadsMeetings: true, jobsField: true, approvals: true, recurring: true },
      "/expense-categories": [{ id: "cat-labour", name: "Site Labour", archivedAt: null, accountCode: "5200", accountName: "Direct Labour" }],
      "/expenses/labour-trades": [],
      [JOBS_PATH]: [MARINA],
    }) as unknown as SessionContextValue["request"];
    renderWithSession(<NewExpenseScreen />, { request });
    await act(async () => {});
    await act(async () => screen.UNSAFE_getByProps({ testID: "expense-mode" }).props.onValueChange("Headcount × day rate"));
    fireEvent.changeText(screen.getByTestId("trade-name-0"), "Mason");
    fireEvent.changeText(screen.getByTestId("trade-workers-0"), "4");
    fireEvent.changeText(screen.getByTestId("trade-rate-0"), "220");
    await act(async () => fireEvent.press(screen.getByTestId("trade-add")));
    // The new row is open; Mason folds to one line with its total.
    expect(screen.getByTestId("trade-name-1")).toBeTruthy();
    expect(screen.queryByTestId("trade-name-0")).toBeNull();
    expect(screen.getByRole("button", { name: "Mason, 4 × $220.00, $880.00. Edit" })).toBeTruthy();
    fireEvent.press(screen.getByTestId("trade-row-0"));
    expect(screen.getByTestId("trade-name-0")).toBeTruthy();
    expect(screen.queryByTestId("trade-name-1")).toBeNull();
  });

  describe("TalkBack: every control on Android's screens has a spoken label", () => {
    const ROUTES = routeRequests({
      "/org/modules": { leadsMeetings: true, jobsField: true, approvals: true, recurring: true },
      "/mobile/today?period=month": SUMMARY,
      [JOBS_PATH]: [MARINA, TOWNHOMES],
      [NEXT_MEETINGS_PATH]: [],
      [`/jobs/${MARINA.id}`]: MARINA,
      [`/jobs/${MARINA.id}/milestones`]: MILESTONES,
      [`/jobs/${MARINA.id}/photos`]: photos(3),
      [`/jobs/${MARINA.id}/quotes`]: QUOTES,
      [MY_EXPENSES_PATH]: EXPENSES,
      [NOTIFICATIONS_PATH]: NOTIFICATIONS,
      "/expense-categories": [],
      "/expenses/labour-trades": [],
      [`/quotes/${PRESENTED.id}`]: PRESENTED,
    }) as unknown as SessionContextValue["request"];

    type Node = ReturnType<typeof screen.UNSAFE_root.findAll>[number];
    /** What a screen reader says for a control: its label, else the text inside it. */
    function spoken(node: Node): string {
      if (typeof node.props.accessibilityLabel === "string") return node.props.accessibilityLabel;
      const texts: unknown[] = node.findAll((child: Node) => (child.type as unknown) === "Text").flatMap((child: Node) => [child.props.children].flat(Infinity));
      return texts.filter((part) => typeof part === "string" || typeof part === "number").join("");
    }
    function unlabelled(): string[] {
      const controls = screen.UNSAFE_root.findAll(
        (node: Node) => typeof node.type === "string" && (node.props.accessibilityRole === "button" || typeof node.props.onClick === "function"),
      );
      expect(controls.length).toBeGreaterThan(0);
      return controls.filter((node: Node) => !spoken(node).trim()).map((node: Node) => String(node.props.testID ?? node.type));
    }

    beforeEach(async () => {
      jest.replaceProperty(Platform, "OS", "android");
      await cache.write(JOBS_KEY, [MARINA, TOWNHOMES]);
      await cache.write(milestonesKey(MARINA.id), MILESTONES);
    });

    it.each([
      ["Today", <TodayScreen key="s" />],
      ["Jobs", <JobsListScreen key="s" />],
      ["a job", <JobDetailScreen key="s" id={MARINA.id} />],
      ["Expenses", <ExpensesScreen key="s" />],
      ["New expense", <NewExpenseScreen key="s" />],
      ["Search", <SearchScreen key="s" />],
      ["Profile", <ProfileScreen key="s" />],
      ["Notifications", <NotificationsScreen key="s" />],
      ["Mark complete", <MilestoneCompleteScreen key="s" jobId={MARINA.id} milestoneId="m-1" />],
      ["the camera", <CameraScreen key="s" mode="photos" jobId={MARINA.id} />],
      ["Present", <PresentScreen key="s" id={PRESENTED.id} onClose={jest.fn()} />],
      ["Accept", <AcceptScreen key="s" quote={PRESENTED} onBack={jest.fn()} onAccepted={jest.fn()} />],
      ["Decline", <DeclineSheet key="s" quote={PRESENTED} onCancel={jest.fn()} onDeclined={jest.fn()} />],
    ])("%s", async (_name, ui) => {
      renderWithSession(ui, { request: ROUTES });
      await act(async () => {});
      expect(unlabelled()).toEqual([]);
    });

    it("catches a control with nothing to say", () => {
      renderWithSession(
        <Pressable testID="mute" onPress={() => {}} accessibilityRole="button">
          <View />
        </Pressable>,
      );
      expect(unlabelled()).toEqual(["mute"]);
    });

    it("Sync, with photos waiting", async () => {
      await queuePhotos();
      renderWithSession(<SyncScreen />, { request: ROUTES });
      await act(async () => {});
      expect(unlabelled()).toEqual([]);
    });

    it("Sign in", async () => {
      renderWithSession(<SignInScreen />, { state: { status: "signedOut" } });
      await act(async () => {});
      expect(unlabelled()).toEqual([]);
    });
  });
});
