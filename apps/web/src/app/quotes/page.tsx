import { AppShellHeader } from "@spine/ui";
import { AppLayout } from "../../components/app-layout";
import { getSession } from "../../lib/get-session";
import { NAV_SECTIONS } from "../../lib/nav-sections";
import { QuotesExplorer } from "./quotes-explorer";

/** PRD F3 Quotes (Stage 1) — multi-line quotes with versioning, S-03.1/S-03.2/S-03.8/S-03.9/S-03.11. PDF/email/public-link/notifications are Stage 2/3 — see CHANGELOG. */
export default async function QuotesPage() {
  const session = await getSession();

  return (
    <AppLayout
      sections={NAV_SECTIONS}
      userName={session?.user?.name ?? "Signed in"}
      userEmail={session?.user?.email ?? ""}
    >
      <AppShellHeader
        breadcrumb={[{ label: "Sales" }, { label: "Quotes" }]}
        title="Quotes"
        description="Build multi-line quotes, revise sent quotes into new versions, and track validity."
      />
      <QuotesExplorer />
    </AppLayout>
  );
}
