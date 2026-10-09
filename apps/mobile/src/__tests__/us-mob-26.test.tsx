import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import { mockRouter } from "../test-utils/router-mock";
import { ThemeProvider, type ThemeStorage } from "@spine/ui-native";
import { WelcomeScreen, WELCOME_BODY, WELCOME_FOOTER, WELCOME_TITLE } from "../features/welcome/welcome-screen";
import { Orbits } from "../features/brand/orbits";
import { showsWelcome, useWelcome, WelcomeProvider } from "../lib/welcome/welcome-seen";
import Welcome from "../../app/welcome";

const mockStore = new Map<string, string>();
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void mockStore.set(key, value)),
  },
}));

const memoryTheme: ThemeStorage = { getPreference: async () => null, setPreference: async () => {} };

function renderWelcome(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <ThemeProvider storage={memoryTheme}>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}

/** Lays out the words and the button, as the phone would on first draw. */
function layOut() {
  act(() => {
    fireEvent(screen.getByTestId("welcome-copy"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 150 } } });
    fireEvent(screen.getByTestId("welcome-actions"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 110 } } });
  });
}

describe("US-MOB-26 · get a welcome the first time I open the app", () => {
  beforeEach(() => {
    mockStore.clear();
    (SplashScreen.hideAsync as jest.Mock).mockClear();
    (useReducedMotion as jest.Mock).mockReturnValue(false);
  });

  it("is the first screen only for a signed-out phone that hasn't seen it", () => {
    expect(showsWelcome({ signedIn: false, updateRequired: false, welcomeSeen: false })).toBe(true);
    expect(showsWelcome({ signedIn: false, updateRequired: false, welcomeSeen: true })).toBe(false);
    expect(showsWelcome({ signedIn: true, updateRequired: false, welcomeSeen: false })).toBe(false);
    expect(showsWelcome({ signedIn: false, updateRequired: true, welcomeSeen: false })).toBe(false);
  });

  it("shows the illustration, the promise, the sentence, Get started and the footer", () => {
    renderWelcome(<WelcomeScreen onGetStarted={jest.fn()} />);
    expect(screen.getByRole("header", { name: WELCOME_TITLE })).toBeTruthy();
    expect(WELCOME_TITLE).toBe("Today’s jobs, in your pocket");
    expect(screen.getByText("Photos, expenses and sign-offs reach your office — even when there’s no signal.")).toBeTruthy();
    expect(screen.getByText(WELCOME_BODY)).toBeTruthy();
    expect(screen.getByText("Your office sets up your account — you’ll sign in next.")).toBeTruthy();
    expect(screen.getByText(WELCOME_FOOTER)).toBeTruthy();
    expect(screen.getByTestId("welcome-get-started")).toBeTruthy();
    // The app's own work comes out from behind the mark.
    for (const text of ["Marina office fit-out", "3 photos saved", "Fuel", "QUO-0004", "Foundations"]) {
      expect(screen.getByText(text, { includeHiddenElements: true })).toBeTruthy();
      // …but only for the eye: screen readers don't reach it.
      expect(screen.queryByText(text)).toBeNull();
    }
  });

  it("lets screen readers skip the illustration", () => {
    renderWelcome(<WelcomeScreen onGetStarted={jest.fn()} />);
    expect(screen.getByTestId("welcome-illustration", { includeHiddenElements: true }).props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
  });

  it("takes over from the splash once laid out, then starts the motion and the idle loop", () => {
    renderWelcome(<WelcomeScreen onGetStarted={jest.fn()} />);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    expect(screen.UNSAFE_getByType(Orbits).props.moving).toBe(false);
    layOut();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
    expect(screen.UNSAFE_getByType(Orbits).props.moving).toBe(true);
  });

  it("holds still with Reduce Motion or Remove animations", () => {
    (useReducedMotion as jest.Mock).mockReturnValue(true);
    renderWelcome(<WelcomeScreen onGetStarted={jest.fn()} />);
    layOut();
    expect(screen.UNSAFE_getByType(Orbits).props.moving).toBe(false);
  });

  it("lets Get started work straight away, before the motion has run", () => {
    const onGetStarted = jest.fn();
    renderWelcome(<WelcomeScreen onGetStarted={onGetStarted} />);
    fireEvent.press(screen.getByTestId("welcome-get-started"));
    expect(onGetStarted).toHaveBeenCalled();
  });

  it("opens Sign in from Get started and never shows Welcome on this phone again", async () => {
    let seen: boolean | null = null;
    function Probe() {
      seen = useWelcome().seen;
      return null;
    }
    renderWelcome(
      <WelcomeProvider>
        <Welcome />
        <Probe />
      </WelcomeProvider>,
    );
    await waitFor(() => expect(seen).toBe(false));
    fireEvent.press(screen.getByTestId("welcome-get-started"));
    expect(mockRouter.replace).toHaveBeenCalledWith("/sign-in");
    await waitFor(() => expect(seen).toBe(true));
    expect(mockStore.get("spine.mobile.welcome-seen")).toBe("1");
    screen.unmount();

    // Next launch (or after signing out): the flag is already set.
    renderWelcome(
      <WelcomeProvider>
        <Probe />
      </WelcomeProvider>,
    );
    await waitFor(() => expect(seen).toBe(true));
  });

  it("is skipped for good when someone is already signed in, and Android back on it leaves the app", () => {
    const layout = readFileSync(join(__dirname, "../../app/_layout.tsx"), "utf8");
    expect(layout).toContain("if (signedIn && welcomeSeen === false) markSeen();");
    // No back handler: Welcome is the only screen, so Android's back closes the app.
    expect(readFileSync(join(__dirname, "../features/welcome/welcome-screen.tsx"), "utf8")).not.toMatch(/useAndroidBack|BackHandler/);
  });
});
