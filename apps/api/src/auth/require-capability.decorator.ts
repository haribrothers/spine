import { SetMetadata } from "@nestjs/common";
import type { Capability } from "@spine/shared";

export const CAPABILITY_KEY = "spine:requiredCapability";

/**
 * Fine-grained, Staff-tier-only authorization layered ON TOP of Better
 * Auth's org role (@OrgRoles) — it never replaces it. Usage on a
 * Staff-reachable endpoint:
 *
 *   @OrgRoles(["owner", "staff"])
 *   @RequireCapability("quotes.manage")
 *   @Post()
 *   createQuote(...) { ... }
 *
 * Semantics, enforced by CapabilityGuard (see capability.guard.ts):
 *  - role === "owner": always passes, no capability lookup — Owner has
 *    blanket access per PRD §2.1 and is never Team-configurable.
 *  - role === "field": always REJECTED if this decorator is present. Field
 *    is a fixed, non-configurable role; an endpoint reachable by Field
 *    should gate on @OrgRoles alone, never mix in @RequireCapability.
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
