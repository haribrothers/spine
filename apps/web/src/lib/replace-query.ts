/**
 * D-210 — writes a list's state to the address without a navigation.
 * `router.replace` asks the server for the page on every call, so in a
 * production build an earlier keystroke's update can land after a later
 * one and leave a stale `?q=` behind. The browser's `replaceState` is
 * synchronous and Next.js keeps `useSearchParams` in step with it.
 */
export function replaceQuery(pathname: string, query: string): void {
  window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
}
