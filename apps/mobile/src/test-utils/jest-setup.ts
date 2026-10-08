import { configure } from "@testing-library/react-native";
import { cache, memoryBackend } from "../lib/cache/cache-store";

// `pnpm test` runs every package at once; the default 1 s for findBy/waitFor flakes under that load.
configure({ asyncUtilTimeout: 5000 });

// The gauge animates its sweep frame by frame; in tests it's the static
// percentage, so no animation outlives a test.
jest.mock("@spine/ui-native", () => {
  const actual = jest.requireActual("@spine/ui-native");
  const mockReact = jest.requireActual("react");
  const { Text: MockText } = jest.requireActual("react-native");
  return { ...actual, GaugeIndicator: ({ progress }: { progress: number }) => mockReact.createElement(MockText, { testID: "gauge" }, `${Math.round(progress * 100)}%`) };
});

beforeEach(() => {
  cache.setBackend(memoryBackend());
});
