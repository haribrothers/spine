import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Keyboard, Platform } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import "../test-utils/router-mock";
import { apiBaseCandidates, authUrl, normalizeServerAddress } from "../lib/server-address";
import {
  discoverServer,
  INVALID_CREDENTIALS_MESSAGE,
  passwordSignIn,
  SERVER_OFFLINE_MESSAGE,
  SERVER_UNREACHABLE_MESSAGE,
  SignInError,
  TOO_MANY_ATTEMPTS_MESSAGE,
} from "../lib/session/sign-in";
import { SignInScreen } from "../features/auth/sign-in-screen";
import { Orbits } from "../features/brand/orbits";
import { jsonResponse, renderWithSession } from "../test-utils/session";

jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({})) }));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("US-MOB-01 · sign in to my company's Spine on my phone", () => {
  describe("the server address", () => {
    it("accepts what people type: no scheme, trailing slashes, upper case", () => {
      expect(normalizeServerAddress("Spine.Riverstone.example/")).toBe("https://spine.riverstone.example");
      expect(normalizeServerAddress(" http://192.168.1.23:4000 ")).toBe("http://192.168.1.23:4000");
      expect(normalizeServerAddress("localhost:4000")).toBe("https://localhost:4000");
    });

    it("rejects things that can't be a server", () => {
      expect(normalizeServerAddress("")).toBeNull();
      expect(normalizeServerAddress("riverstone")).toBeNull();
      expect(normalizeServerAddress("ftp://spine.example")).toBeNull();
    });

    it("looks for the API behind /api first, then at the address itself", () => {
      expect(apiBaseCandidates("https://spine.example")).toEqual(["https://spine.example/api", "https://spine.example"]);
      expect(apiBaseCandidates("https://spine.example/api")).toEqual(["https://spine.example/api", "https://spine.example"]);
      expect(authUrl("https://spine.example/api", "sign-in/email")).toBe("https://spine.example/api/api/auth/sign-in/email");
    });
  });

  describe("finding the server", () => {
    it("uses /api when it answers as Spine, keeping the web address for Forgot password", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "ok", service: "spine", appUrl: "https://spine.example" }));
      await expect(discoverServer("spine.example", async () => true)).resolves.toEqual({
        server: "https://spine.example",
        apiBase: "https://spine.example/api",
        appUrl: "https://spine.example",
      });
    });

    it("falls back to the address itself (the API's own port in development)", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(404, {})).mockResolvedValueOnce(jsonResponse(200, { status: "ok", service: "spine", appUrl: null }));
      const info = await discoverServer("http://localhost:4000", async () => true);
      expect(info.apiBase).toBe("http://localhost:4000");
    });

    it("says it can't reach a server that isn't Spine or doesn't answer", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "ok", service: "wordpress" })).mockRejectedValueOnce(new TypeError("Network request failed"));
      await expect(discoverServer("example.com", async () => true)).rejects.toMatchObject({ field: "server", message: SERVER_UNREACHABLE_MESSAGE });
    });

    it("says the phone is offline when it is", async () => {
      fetchMock.mockRejectedValue(new TypeError("Network request failed"));
      await expect(discoverServer("spine.example", async () => false)).rejects.toMatchObject({ field: "server", message: SERVER_OFFLINE_MESSAGE });
    });
  });

  describe("signing in", () => {
    it("returns the bearer token from set-auth-token", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: "x" }, { "set-auth-token": "session-token" }));
      await expect(passwordSignIn("https://spine.example/api", "marcus@example.com", "pw")).resolves.toBe("session-token");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://spine.example/api/api/auth/sign-in/email");
      expect(init.headers["X-Spine-Client-Version"]).toBeTruthy();
      // A stored session cookie would trip Better Auth's origin check on a later sign-in.
      expect(init.credentials).toBe("omit");
    });

    it("says what to do next for wrong credentials", async () => {
      expect(INVALID_CREDENTIALS_MESSAGE).toBe("That email and password don't match. Check both, or reset your password.");
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: "Invalid email or password" }));
      const error = await passwordSignIn("https://spine.example/api", "marcus@example.com", "wrong").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SignInError);
      expect(error).toMatchObject({ field: "password", message: INVALID_CREDENTIALS_MESSAGE });
    });
  });

  describe("rate limits", () => {
    it("says to wait when the server limits sign-in attempts", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(429, {}));
      await expect(passwordSignIn("https://spine.example/api", "marcus@example.com", "pw")).rejects.toMatchObject({ field: "form", message: TOO_MANY_ATTEMPTS_MESSAGE });
    });
  });

  describe("the screen", () => {
    it("shows the copy and fields from the story", () => {
      renderWithSession(<SignInScreen />, { state: { status: "signedOut" } });
      expect(screen.getByRole("header", { name: "Sign in" })).toBeTruthy();
      expect(screen.getByText("Use the email your office invited you with.")).toBeTruthy();
      expect(screen.getByText("Server")).toBeTruthy();
      expect(screen.getByText("Email")).toBeTruthy();
      expect(screen.getByText("Password")).toBeTruthy();
      expect(screen.getByText("The server address is the link you open Spine with on a computer.")).toBeTruthy();
      expect(screen.getByText("You stay signed in on this phone until you sign out.")).toBeTruthy();
      expect(screen.getByTestId("sign-in-forgot")).toBeTruthy();
    });

    it("shows the Spine logo on the illustration, which screen readers skip", () => {
      renderWithSession(<SignInScreen />, { state: { status: "signedOut" } });
      expect(screen.getByLabelText("Spine")).toBeTruthy();
      const hidden = screen.getByTestId("sign-in-hero").children[0] as unknown as { props: Record<string, unknown> };
      expect(hidden.props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
    });

    it("folds the illustration to the horizontal logo while the keyboard is up", () => {
      const listeners: Record<string, () => void> = {};
      jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, listener: () => void) => {
        listeners[event] = listener;
        return { remove: jest.fn() };
      }) as never);
      renderWithSession(<SignInScreen />, { state: { status: "signedOut" } });
      expect(screen.getByTestId("sign-in-hero")).toBeTruthy();
      const opened = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
      const closed = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
      act(() => listeners[opened]!());
      expect(screen.queryByTestId("sign-in-hero")).toBeNull();
      expect(screen.getByTestId("sign-in-compact-logo")).toBeTruthy();
      expect(screen.getByLabelText("Spine")).toBeTruthy();
      act(() => listeners[closed]!());
      expect(screen.getByTestId("sign-in-hero")).toBeTruthy();
      jest.restoreAllMocks();
    });

    it("only drifts the orbits slowly, and holds still with Reduce Motion", () => {
      renderWithSession(<SignInScreen />, { state: { status: "signedOut" } });
      expect(screen.UNSAFE_getByType(Orbits).props.moving).toBe(true);
      screen.unmount();
      (useReducedMotion as jest.Mock).mockReturnValue(true);
      renderWithSession(<SignInScreen />, { state: { status: "signedOut" } });
      expect(screen.UNSAFE_getByType(Orbits).props.moving).toBe(false);
      (useReducedMotion as jest.Mock).mockReturnValue(false);
    });

    it("puts the error under the field it's about", async () => {
      const signIn = jest.fn(async () => ({ ok: false as const, field: "password" as const, message: INVALID_CREDENTIALS_MESSAGE }));
      renderWithSession(<SignInScreen />, { state: { status: "signedOut", lastServer: "https://spine.example", lastEmail: "marcus@example.com" }, signIn });
      fireEvent.changeText(screen.getByTestId("sign-in-password"), "wrong");
      fireEvent.press(screen.getByTestId("sign-in-submit"));
      await waitFor(() => expect(screen.getByText(INVALID_CREDENTIALS_MESSAGE)).toBeTruthy());
      expect(signIn).toHaveBeenCalledWith("https://spine.example", "marcus@example.com", "wrong");
    });

    it("asks for every field before trying", () => {
      const signIn = jest.fn();
      renderWithSession(<SignInScreen />, { state: { status: "signedOut" }, signIn });
      fireEvent.press(screen.getByTestId("sign-in-submit"));
      expect(signIn).not.toHaveBeenCalled();
      expect(screen.getByText("Enter your password.")).toBeTruthy();
    });

    it("opens the server's reset page for Forgot password", async () => {
      const WebBrowser = jest.requireMock("expo-web-browser") as { openBrowserAsync: jest.Mock };
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "ok", service: "spine", appUrl: "https://spine.example" }));
      renderWithSession(<SignInScreen />, { state: { status: "signedOut", lastServer: "spine.example" } });
      fireEvent.press(screen.getByTestId("sign-in-forgot"));
      await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith("https://spine.example/forgot-password"));
    });
  });
});
