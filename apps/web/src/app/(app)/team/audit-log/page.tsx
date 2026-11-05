import { Suspense } from "react";
import { getMyMembership } from "../../../../lib/get-my-membership";
import { NoAccess } from "../../../../components/no-access";
import { t } from "../../../../lib/i18n";
import { AuditLogExplorer } from "./audit-log-explorer";

/**
 * US-SET-11/12 (D-064) — the organisation audit log, Owner-only and never
 * Team-configurable. A Staff or Field user who opens it gets the no-access
 * page; the API refuses them too.
 */
export default async function AuditLogPage() {
  const membership = await getMyMembership();
  if (membership?.role !== "owner") return <NoAccess pageName={t("team.auditLog.title")} ownerOnly />;
  return (
    <Suspense>
      <AuditLogExplorer />
    </Suspense>
  );
}
