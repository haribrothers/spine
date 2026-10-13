import type { ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, type ThemeStorage } from "./theme-provider";

/**
 * Collapses the theme + safe-area + status-bar boilerplate every native app
 * (`apps/mobile`, `apps/showcase-native`)
 * previously hand-wired identically at its own root (`App.tsx`/
 * `app/_layout.tsx`) into one import. Each app still supplies its own
 * `storage` adapter (per `ThemeProvider`'s own doc comment, this package
 * stays storage-agnostic) and nests any app-specific top-level providers
 * (e.g. showcase-native's `ProfileSheetProvider`) inside/around this one —
 * `SpineUIProvider` only owns the providers `packages/ui-native` itself
 * requires, not app-specific state.
 */
export function SpineUIProvider({ storage, children }: { storage: ThemeStorage; children: ReactNode }) {
  return (
    <ThemeProvider storage={storage}>
      <SafeAreaProvider>
        {children}
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
