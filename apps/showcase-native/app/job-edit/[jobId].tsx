import { useLocalSearchParams } from "expo-router";
import { JobEditForm } from "../../src/components/templates/job-edit-form";

/**
 * Lives OUTSIDE `(tabs)` entirely — a sibling of the tabs group in the root
 * stack (`app/_layout.tsx`), not nested under `templates/`. This is the
 * WhatsApp chat-screen pattern: the bottom tab bar (`NativeTabs`) only
 * renders while a screen INSIDE the tabs group is active; a screen that
 * isn't a descendant of the tab navigator at all never has the tab bar
 * mounted over it in the first place — nothing to hide, it was never there.
 *
 * This replaced two routes previously nested under `(tabs)/templates/`
 * (`templates/edit.tsx` and `templates/list-detail/edit/[jobId].tsx`) that
 * shared this exact same `JobEditForm` — both were real, reported bugs: the
 * sticky Cancel/Save footer rendered underneath/behind the Templates tab's
 * own always-visible native tab bar on iOS, because a screen pushed onto a
 * tab's own nested `Stack` stays a descendant of `NativeTabs` the whole
 * time, so the tab bar never goes away for it. `NativeTabs`
 * (`expo-router`'s `unstable-native-tabs`) has no per-screen "hide the tab
 * bar" prop in this version (confirmed against its own type definitions),
 * so moving the route out of the tabs group entirely — not fighting the
 * component for a hide flag it doesn't expose — is the fix.
 *
 * **This is a plain pushed sibling route (`router.push`, default `card`
 * presentation), NOT a modal.** Do not change this to
 * `presentation: "formSheet"` (or any modal presentation) without reading
 * `app/_layout.tsx`'s own doc comment first — a root-level sibling
 * `Stack.Screen` with `presentation: "formSheet"` next to `(tabs)` hit a
 * real, severe, confirmed-on-device `NativeTabs` incompatibility (the app
 * booted straight into the modal instead of Home, not fixable even by a
 * full native rebuild from an erased simulator), which is why Profile was
 * moved to a bare `<Modal>` outside the router instead. An ordinary
 * non-modal push is a different, far more common navigation pattern and
 * was verified working on-device for this route specifically before this
 * comment was written — but if a similar boot-order bug ever resurfaces,
 * suspect the presentation mode, not routing this screen outside the tabs
 * group (which is the part that's actually fixing the tab-bar-overlap bug).
 */
export default function JobEditScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  return <JobEditForm jobId={jobId} />;
}
