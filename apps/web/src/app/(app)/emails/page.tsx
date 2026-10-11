import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { EmailsExplorer } from "./emails-explorer";

/** US-SET-27 (D-220) — every email Spine sends, and what happened to it. Owner only (page-access.ts). */
export default function EmailsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Settings" }, { label: "Email log" }]}
        title="Email log"
        description="Every email Spine sends — to customers and your team — and what happened to it. Kept for 180 days."
      />
      {/* The explorer reads its state from the address. */}
      <Suspense>
        <EmailsExplorer />
      </Suspense>
    </>
  );
}
