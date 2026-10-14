"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@spine/ui";
import type { CatalogBundle } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { BundlesView } from "./bundles-view";
import { CatalogExplorer } from "./catalog-explorer";
import type { CatalogItem } from "./types";

function Count({ n }: { n: number | null }) {
  if (n === null) return null;
  return <span className="ml-1.5 rounded-full border border-border bg-surface-sunken px-1.5 text-[11px] font-semibold tabular-nums text-on-surface-muted group-data-[state=active]:border-transparent group-data-[state=active]:bg-info-bg group-data-[state=active]:text-primary">{n}</span>;
}

/**
 * US-QUO-25 — Catalogue has Items and Bundles; `?tab=bundles` opens the
 * second. US-CAT-14 (D-213): each tab shows its count of active entries.
 */
export function CatalogTabs({ initialDrawerOpen }: { initialDrawerOpen: boolean }) {
  const router = useRouter();
  const tab = useSearchParams().get("tab") === "bundles" ? "bundles" : "items";
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [bundleCount, setBundleCount] = useState<number | null>(null);

  const loadBundleCount = useCallback(() => {
    apiClient
      .get<CatalogBundle[]>("/catalog-bundles")
      .then((rows) => setBundleCount(rows.length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadBundleCount();
    apiClient
      .get<CatalogItem[]>("/catalog-items")
      .then((rows) => setItemCount(rows.length))
      .catch(() => {});
  }, [loadBundleCount]);

  return (
    <Tabs value={tab} onValueChange={(next) => router.replace(next === "bundles" ? "/catalog?tab=bundles" : "/catalog")}>
      <TabsList className="mb-4">
        <TabsTrigger value="items" className="group" aria-label={itemCount === null ? "Items" : `Items, ${itemCount}`}>
          Items
          <Count n={itemCount} />
        </TabsTrigger>
        <TabsTrigger value="bundles" className="group" aria-label={bundleCount === null ? "Bundles" : `Bundles, ${bundleCount}`}>
          Bundles
          <Count n={bundleCount} />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="items">
        <CatalogExplorer initialDrawerOpen={initialDrawerOpen} onActiveCountChange={setItemCount} onBundleSaved={loadBundleCount} />
      </TabsContent>
      <TabsContent value="bundles">
        <BundlesView onChooseItems={() => router.replace("/catalog")} onCountChange={setBundleCount} />
      </TabsContent>
    </Tabs>
  );
}
