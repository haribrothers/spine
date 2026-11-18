import { useSyncExternalStore } from "react";

/** Under the tablet breakpoint (768px in tokens.json), where the phone layout applies (D-283). */
export const PHONE_QUERY = "(max-width: 767.98px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True on a phone-width screen; false on the server and in tests without matchMedia. */
export function usePhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window.matchMedia === "function" ? window.matchMedia(PHONE_QUERY).matches : false),
    () => false,
  );
}
