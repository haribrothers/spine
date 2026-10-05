import { AppShellHeader } from "@spine/ui";
import { Suspense } from "react";
import { CatalogTabs } from "./catalog-tabs";

/**
 * PRD F2 Catalogue — goods/services with a default price/unit/tax rate for
 * fast quoting (S-02.1). `?new=1` auto-opens the create Drawer, matching
 * contacts/page.tsx's own convention.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { new: newParam } = await searchParams;

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Sales" }, { label: "Catalogue" }]}
        title="Catalogue"
        description="Goods and services you quote, invoice and sell."
      />
      <Suspense>
        <CatalogTabs initialDrawerOpen={newParam === "1"} />
      </Suspense>
    </>
  );
}
