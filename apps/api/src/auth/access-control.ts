import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, ownerAc } from "better-auth/plugins/organization/access";

/**
 * These roles govern *organization membership* — who can invite/remove
 * members, rename the org, etc. (Better Auth's own domain). They are not
 * the business-permission matrix from docs/spine-prd.md §2.1 (who can
 * create quotes, view the ledger, approve expenses) — that's enforced by
 * each feature module's own authorization checks against `@OrgRoles()` /
 * the member role on the session, not by this access-control statement.
 *
 * Role names match §2.1 exactly: owner, staff, field. ("customer" isn't a
 * member role — customers only ever reach the app via signed, expiring
 * public quote links per §6.2, never a session.)
 */
const statement = {
  ...defaultStatements,
} as const;

export const accessControl = createAccessControl(statement);

export const ownerRole = accessControl.newRole({
  ...ownerAc.statements,
});

/** Staff can invite/manage other members but not delete the org. */
export const staffRole = accessControl.newRole({
  organization: ["update"],
  member: ["create", "update"],
  invitation: ["create", "cancel"],
});

/** Field crew has no organization-management permissions. */
export const fieldRole = accessControl.newRole({});
