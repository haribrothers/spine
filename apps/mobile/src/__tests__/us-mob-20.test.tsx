import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Alert, Platform } from "react-native";
import { screen } from "@testing-library/react-native";
import "../test-utils/router-mock";
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
});
