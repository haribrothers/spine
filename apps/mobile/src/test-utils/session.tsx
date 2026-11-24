import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, type ThemeStorage } from "@spine/ui-native";
import { SessionContext, type SessionContextValue } from "../lib/session/session-provider";
import type { StoredSession } from "../lib/session/storage";

export const MARCUS: StoredSession = {
  server: "https://spine.riverstone.example",
  apiBase: "https://spine.riverstone.example/api",
  appUrl: "https://spine.riverstone.example",
  token: "test-token",
  member: { name: "Marcus Webb", email: "marcus.webb@riverstone.example", role: "field", organizationName: "Riverstone Builders" },
};

const memoryTheme: ThemeStorage = { getPreference: async () => null, setPreference: async () => {} };

/** Renders a screen under a fixed session; returns the context's spies. */
export function renderWithSession(ui: React.ReactElement, overrides: Partial<SessionContextValue> = {}) {
  const value: SessionContextValue = {
    state: { status: "signedIn", session: MARCUS },
    updateRequired: false,
    lastSession: MARCUS,
    signIn: jest.fn(async () => ({ ok: true as const })),
    signOut: jest.fn(async () => {}),
    request: jest.fn(async () => MARCUS.member) as unknown as SessionContextValue["request"],
    choosePassword: jest.fn(async () => {}),
    ...overrides,
  };
  const utils = render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider storage={memoryTheme}>
        <SessionContext.Provider value={value}>{ui}</SessionContext.Provider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return { ...utils, session: value };
}

/** A fetch Response stand-in. */
export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}
