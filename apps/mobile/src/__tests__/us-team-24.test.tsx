import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import "../test-utils/router-mock";
import { apiRequest } from "../lib/api/request";
import { ApiError, PasswordChangeRequiredError } from "../lib/api/errors";
import { ChoosePasswordScreen } from "../features/auth/choose-password-screen";
import { jsonResponse, MARCUS, renderWithSession } from "../test-utils/session";

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const GIVEN_BY = { ...MARCUS, member: { ...MARCUS.member, mustChangePassword: true, passwordSetBy: { name: "Priya Raman", at: "2026-10-12T09:00:00Z" } } };

describe("US-TEAM-24 · choose your own password on the phone", () => {
  it("maps the server's PASSWORD_CHANGE_REQUIRED to its own error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { error: "PASSWORD_CHANGE_REQUIRED", message: "Choose your own password to keep going." }));
    await expect(apiRequest("https://x/api", "GET", "/jobs", { token: "t" }, async () => true)).rejects.toBeInstanceOf(PasswordChangeRequiredError);
  });

  it("says who set it, checks the two match, then saves through the session", async () => {
    const choosePassword = jest.fn(async () => {});
    renderWithSession(<ChoosePasswordScreen />, { state: { status: "signedIn", session: GIVEN_BY }, lastSession: GIVEN_BY, choosePassword });
    expect(screen.getByText(/Priya Raman set a password for you on (12 Oct|Oct 12)\. Choose one only you know/)).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("choose-password-new"), "harbor-Velvet-73-quill");
    fireEvent.changeText(screen.getByTestId("choose-password-confirm"), "harbor-Velvet-73-quil");
    fireEvent.press(screen.getByTestId("choose-password-submit"));
    expect(await screen.findByText("The passwords don't match.")).toBeTruthy();
    expect(choosePassword).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId("choose-password-confirm"), "harbor-Velvet-73-quill");
    fireEvent.press(screen.getByTestId("choose-password-submit"));
    await waitFor(() => expect(choosePassword).toHaveBeenCalledWith("harbor-Velvet-73-quill"));
  });

  it("shows the server's answer under the field when it's the password they were given", async () => {
    const choosePassword = jest.fn(async () => {
      throw new ApiError("That's the password you were given. Choose a different one.", 400, "SAME_AS_GIVEN_PASSWORD");
    });
    renderWithSession(<ChoosePasswordScreen />, { state: { status: "signedIn", session: GIVEN_BY }, lastSession: GIVEN_BY, choosePassword });
    fireEvent.changeText(screen.getByTestId("choose-password-new"), "copper-Tide-48-lantern");
    fireEvent.changeText(screen.getByTestId("choose-password-confirm"), "copper-Tide-48-lantern");
    fireEvent.press(screen.getByTestId("choose-password-submit"));
    expect(await screen.findByText("That's the password you were given. Choose a different one.")).toBeTruthy();
  });

  it("offers Sign out", () => {
    const signOut = jest.fn(async () => {});
    renderWithSession(<ChoosePasswordScreen />, { state: { status: "signedIn", session: GIVEN_BY }, lastSession: GIVEN_BY, signOut });
    fireEvent.press(screen.getByTestId("choose-password-sign-out"));
    expect(signOut).toHaveBeenCalled();
  });
});
