import { SetMetadata } from "@nestjs/common";
import type { Capability } from "@spine/shared";

export const CAPABILITY_KEY = "spine:requiredCapability";

/**
 * Fine-grained, Staff-tier-only authorization layered ON TOP of Better
 * Auth's org role (@OrgRoles) — it never replaces it. Usage on a
 * Staff-reachable endpoint:
 *
 *   @OrgRoles(["owner", "staff"])
 *   @RequireCapability("quotes.edit_own")
 *   @Post()
 *   createQuote(...) { ... }
 *
 * Semantics, enforced by CapabilityGuard (see capability.guard.ts):
 *  - role === "owner": always passes, no capability lookup — Owner has
 *    blanket access per PRD §2.1 and is never Team-configurable.
 *  - role === "field": always passes if this route's own @OrgRoles lists
 *    "field" (Better Auth's AuthGuard already evaluated @OrgRoles and
 *    would have 403'd first if not) — Field is fixed/non-configurable, so
 *    there is no Team grant to check; @RequireCapability on a
 *    Field-reachable route exists only to label WHICH capability the
 *    route corresponds to (for the privilege-matrix UI's own bookkeeping/
 *    documentation), not to gate Field further. If @OrgRoles does NOT
 *    list "field" for this route, Field never reaches this guard at all
 *    (AuthGuard already rejected it), so this case is moot for those.
 *  - role === "staff": passes iff the union of the caller's Team grants
 *    includes this capability (most-permissive-wins, per §2.1).
 *
 * Never apply this to the hard-coded Owner-only surface (manage users,
 * teams, permissions, org settings, tax rules) — those stay
 * @OrgRoles(["owner"]) alone, per §2.1's explicit "not Team-configurable"
 * carve-out. This guard has no concept of that boundary; it's enforced
 * simply by never putting @RequireCapability on those controllers.
 */
export const RequireCapability = (capability: Capability) => SetMetadata(CAPABILITY_KEY, capability);

export const SECTION_KEY = "spine:requiredSection";
export const PICKER_KEY = "spine:pickerAllowed";

/**
 * US-TEAM-30 (D-235) — the section's Open permission, put on a section's
 * controller. Checked as well as any @RequireCapability (never instead of
 * it), so a Team with a section closed reaches none of its routes. Owners
 * and Field pass, as for @RequireCapability.
 */
export const RequireSectionOpen = (capability: Capability) => SetMetadata(SECTION_KEY, capability);

/**
 * US-TEAM-31 — a route other sections use as a picker (a customer on an
 * invoice, an item on a quote line, a job on an expense). With `?picker=1`
 * it answers without the section's Open permission, and the guard marks the
 * request `sectionClosed` so the route returns only what forms need.
 */
export const PickerAllowed = () => SetMetadata(PICKER_KEY, true);
