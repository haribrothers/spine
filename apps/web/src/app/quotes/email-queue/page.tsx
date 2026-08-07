import { AppShellHeader } from "@spine/ui";
import { AppLayout } from "../../../components/app-layout";
import { getSession } from "../../../lib/get-session";
import { NAV_SECTIONS } from "../../../lib/nav-sections";
import { EmailQueueView } from "./email-queue-view";

/** Item 7, user feedback — a cross-quote view of every not-yet-resolved quote-send-email job, so pending/retrying/permanently-failed sends are visible without inspecting pg-boss's own job table. */
export default async function QuotesEmailQueuePage() {
  const session = await getSession();

  return (
    <AppLayout
      sections={NAV_SECTIONS}
      userName={session?.user?.name ?? "Signed in"}
      userEmail={session?.user?.email ?? ""}
    >
      <AppShellHeader
        breadcrumb={[{ label: "Sales" }, { label: "Quotes", href: "/quotes" }, { label: "Email queue" }]}
        title="Email queue"
        description="Quote emails that are queued, retrying, or still in flight."
      />
      <EmailQueueView />
    </AppLayout>
  );
}
