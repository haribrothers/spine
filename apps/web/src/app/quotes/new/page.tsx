import { AppShellHeader } from "@spine/ui";
import { AppLayout } from "../../../components/app-layout";
import { getSession } from "../../../lib/get-session";
import { NAV_SECTIONS } from "../../../lib/nav-sections";
import { QuoteBuilder } from "../quote-builder";

export default async function NewQuotePage() {
  const session = await getSession();

  return (
    <AppLayout
      sections={NAV_SECTIONS}
      userName={session?.user?.name ?? "Signed in"}
      userEmail={session?.user?.email ?? ""}
    >
      <AppShellHeader
        breadcrumb={[{ label: "Sales" }, { label: "Quotes", href: "/quotes" }, { label: "New" }]}
        title="New quote"
        description="Build a multi-line quote. It saves as a draft until you send it."
      />
      <QuoteBuilder />
    </AppLayout>
  );
}
