import { AppShellHeader } from "@spine/ui";
import { QuoteBuilder } from "../quote-builder";

export default function NewQuotePage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Sales" }, { label: "Quotes", href: "/quotes" }, { label: "New" }]}
        title="New quote"
        description="Build a multi-line quote. It saves as a draft until you send it."
      />
      <QuoteBuilder />
    </>
  );
}
