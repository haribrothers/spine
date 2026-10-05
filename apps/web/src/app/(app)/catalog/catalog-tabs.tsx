"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@spine/ui";
import { BundlesView } from "./bundles-view";
import { CatalogExplorer } from "./catalog-explorer";

/** US-QUO-25 — Catalogue has Items and Bundles; `?tab=bundles` opens the second. */
export function CatalogTabs({ initialDrawerOpen }: { initialDrawerOpen: boolean }) {
  const router = useRouter();
  const tab = useSearchParams().get("tab") === "bundles" ? "bundles" : "items";
  return (
    <Tabs value={tab} onValueChange={(next) => router.replace(next === "bundles" ? "/catalog?tab=bundles" : "/catalog")}>
      <TabsList className="mb-4">
        <TabsTrigger value="items">Items</TabsTrigger>
        <TabsTrigger value="bundles">Bundles</TabsTrigger>
      </TabsList>
      <TabsContent value="items">
        <CatalogExplorer initialDrawerOpen={initialDrawerOpen} />
      </TabsContent>
      <TabsContent value="bundles">
        <BundlesView />
      </TabsContent>
    </Tabs>
  );
}
