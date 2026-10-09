/**
 * A development build opens the bundle with
 * `spine://expo-development-client/?url=…`. That isn't a screen, and routing
 * to it at launch made the router update the stack before it had mounted, so
 * it opens the app's first screen instead. Every other link passes through.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return path.includes("expo-development-client") ? "/" : path;
}
