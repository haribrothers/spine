import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { t } from "../../../lib/i18n";
import { EmailsExplorer } from "./emails-explorer";

/** US-SET-27 (D-220) — every email Spine sends, and what happened to it. Owner only (page-access.ts). */
export default function EmailsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("emails.page.breadcrumbSettings") }, { label: t("emails.page.title") }]}
        title={t("emails.page.title")}
        description={t("emails.page.description")}
      />
      {/* The explorer reads its state from the address. */}
      <Suspense>
        <EmailsExplorer />
      </Suspense>
    </>
  );
}
