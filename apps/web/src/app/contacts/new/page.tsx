import { redirect } from "next/navigation";

/**
 * Phase 2 replaced the full-page create form with a Drawer opened from the
 * list page (per the task brief's Settings-dialog precedent question) —
 * but unlike Settings ("Dialog only, no URLs," an explicit prior decision
 * for org-config screens with no shareable resource behind them), Contacts'
 * create flow produces a real, shareable/bookmarkable resource once saved
 * (the new contact's own `/contacts/:id`), and a "create a contact" link is
 * a plausible thing to bookmark or share *before* that resource exists
 * (e.g. an onboarding checklist item, a support doc). So the route is kept,
 * not deleted, but now redirects into the list page with `?new=1` — see
 * apps/web/src/app/contacts/page.tsx's own comment — rather than rendering
 * its own full-page form, so there's exactly one create implementation
 * (the Drawer) instead of two to keep in sync.
 */
export default function NewContactPage() {
  redirect("/contacts?new=1");
}
