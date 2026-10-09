import { configure } from "@testing-library/react-native";
import { cache, memoryBackend } from "../lib/cache/cache-store";
import { outbox } from "../lib/outbox/outbox";
import { memoryOutboxBackend } from "../lib/outbox/outbox-store";
import { syncEngine } from "../lib/outbox/sync-engine";
import { connectivity } from "../lib/connectivity";
import { discardedFiles, missingFiles, testFiles } from "./outbox";

// Native modules the outbox's file helpers load; tests use `testFiles` instead.
// Files on the phone: no-ops (tests spy on `File.prototype.write` to see what was written). Like the real one, a File is a Blob, so it goes into FormData.
jest.mock("expo-file-system", () => ({
  File: class extends Blob {
    constructor() {
      super([]);
    }
    create() {}
    write() {}
    delete() {}
    exists = false;
    static downloadFileAsync: jest.Mock = jest.fn(async () => ({ uri: "file:///cache/files/downloaded" }));
  },
  Directory: class {
    exists = true;
    create() {}
  },
  Paths: { cache: "cache", document: "document" },
}));
jest.mock("expo-image-manipulator", () => ({ manipulateAsync: jest.fn(), SaveFormat: { JPEG: "jpeg" } }));

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
  outbox.reset(memoryOutboxBackend(), testFiles);
  discardedFiles.length = 0;
  missingFiles.clear();
  connectivity.set(true);
});

afterEach(() => {
  syncEngine.setTransport(null);
  syncEngine.stop();
});
