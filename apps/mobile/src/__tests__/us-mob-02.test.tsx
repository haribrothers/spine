import { ActionSheetIOS, Alert } from "react-native";
import { fireEvent, screen } from "@testing-library/react-native";
import "../test-utils/router-mock";
import { describePending, signOutWarning } from "../lib/outbox/pending";
import { initials, roleLine } from "../lib/member-display";
import { confirmSignOut } from "../features/profile/sign-out";
import { FIELD_NOTE, ProfileScreen, profileScreenOptions } from "../features/profile/profile-screen";
import { renderWithSession } from "../test-utils/session";

describe("US-MOB-02 · stay signed in and sign out safely", () => {
  it("shows name, role and business, email, server, appearance, the Field note and Sign out", () => {
    renderWithSession(<ProfileScreen />);
    expect(screen.getByText("Marcus Webb")).toBeTruthy();
    expect(screen.getByText("Field · Riverstone Builders")).toBeTruthy();
    expect(screen.getByText("marcus.webb@riverstone.example")).toBeTruthy();
    expect(screen.getByText("spine.riverstone.example")).toBeTruthy();
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.getByText("All synced")).toBeTruthy();
    expect(screen.getByText(FIELD_NOTE)).toBeTruthy();
    expect(screen.getByTestId("profile-sign-out")).toBeTruthy();
  });

  it("signs straight out when nothing is waiting", () => {
    const signOut = jest.fn(async () => {});
    renderWithSession(<ProfileScreen />, { signOut });
    fireEvent.press(screen.getByTestId("profile-sign-out"));
    expect(signOut).toHaveBeenCalled();
  });

  it("opens as an iOS form sheet with a Close header item, and as an Android page", () => {
    const onClose = jest.fn();
    const ios = profileScreenOptions("ios", { background: "#F7F6F3" }, onClose);
    expect(ios).toMatchObject({ presentation: "formSheet", headerShown: true, title: "Profile" });
    const [close] = (ios as { unstable_headerRightItems: () => { label: string; onPress: () => void }[] }).unstable_headerRightItems();
    expect(close).toMatchObject({ label: "Close", accessibilityLabel: "Close" });
    close!.onPress();
    expect(onClose).toHaveBeenCalled();
    expect(profileScreenOptions("android", { background: "#F7F6F3" }, onClose)).toMatchObject({ headerShown: true, title: "Profile" });
  });

  it("names what would be lost", () => {
    expect(describePending({ photos: 2, expenses: 1, completions: 0 })).toBe("2 site photos and 1 expense");
    expect(describePending({ photos: 1, expenses: 0, completions: 3 })).toBe("1 site photo and 3 milestone updates");
    expect(signOutWarning({ photos: 2, expenses: 1, completions: 0 })).toEqual({
      title: "3 items haven't reached your office yet. Sign out anyway?",
      message: "2 site photos and 1 expense are still waiting to sync. Signing out deletes them from this phone.",
    });
  });

  it("warns on iOS with Send them first, Sign out anyway (destructive) and Cancel", () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation(() => {});
    const signOut = jest.fn();
    confirmSignOut({ photos: 2, expenses: 1, completions: 0 }, { signOut, sendFirst: jest.fn() });
    const [options, callback] = sheet.mock.calls[0]!;
    expect(options.options).toEqual(["Send them first", "Sign out anyway", "Cancel"]);
    expect(options.destructiveButtonIndex).toBe(1);
    callback(1);
    expect(signOut).toHaveBeenCalled();
    sheet.mockRestore();
  });

  it("formats initials and the role line", () => {
    expect(initials({ name: "Marcus Webb", email: "m@example.com" })).toBe("MW");
    expect(initials({ name: "", email: "sarah@example.com" })).toBe("S");
    expect(roleLine({ role: "staff", organizationName: "Riverstone Builders" })).toBe("Staff · Riverstone Builders");
    expect(Alert.alert).toBeDefined();
  });
});

describe("US-MOB-02 · signing out doesn't break the screens being closed", () => {
  it("keeps rendering Profile from the last session while the session ends", () => {
    renderWithSession(<ProfileScreen />, { state: { status: "signedOut" } });
    expect(screen.getByText("Marcus Webb")).toBeTruthy();
  });
});
