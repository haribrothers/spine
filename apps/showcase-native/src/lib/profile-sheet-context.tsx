import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ProfileSheetContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const ProfileSheetContext = createContext<ProfileSheetContextValue | null>(null);

/**
 * Profile is a plain `<Modal>` component controlled by this context, NOT a
 * routed `Stack.Screen` — a deliberate structural change, not a stylistic
 * one. The routed version (a root-level sibling `Stack.Screen` with
 * `presentation: "formSheet"`, alongside `(tabs)`) hit a real, severe,
 * fully reproducible bug: the app would boot directly onto the Profile
 * screen instead of Home, confirmed via `usePathname()` debug logging to
 * be a genuine NATIVE rendering issue (React Navigation's own state
 * correctly reported Home/`"/"` as active while Profile still rendered on
 * top) — not fixable by clearing every cache layer tried (Metro, app
 * data, a full native rebuild from a completely erased simulator with
 * zero DerivedData). This points to a real incompatibility between
 * `NativeTabs` (`expo-router`'s experimental native tab host) and a
 * sibling modal `Stack.Screen`, not something this app's own code was
 * doing wrong.
 *
 * Moving Profile out of the router entirely sidesteps that whole class of
 * bug — a plain RN `<Modal>` has no interaction with `NativeTabs`' own
 * native view-controller hierarchy at all. Confirmed with the user that
 * `Modal presentationStyle="formSheet"` renders IDENTICALLY to
 * `Stack.Screen presentation="formSheet"` on iOS (both are thin wrappers
 * around the same real `UIModalPresentationFormSheet`), so this loses
 * nothing visually on the platform where it mattered most. Android's
 * `Modal` has no native `formSheet`-equivalent stacking behavior the way
 * `react-native-screens`' documented "falls back to modal" was — see
 * `app/_layout.tsx`'s own doc comment for how that gap is closed
 * (`animationType="slide"` + a full-screen presentation, matching what was
 * already confirmed working before this change).
 */
export function useProfileSheet() {
  const ctx = useContext(ProfileSheetContext);
  if (!ctx) throw new Error("useProfileSheet must be used within a ProfileSheetProvider");
  return ctx;
}

export function ProfileSheetProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return <ProfileSheetContext.Provider value={value}>{children}</ProfileSheetContext.Provider>;
}
