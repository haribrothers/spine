"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShellHeader, Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@spine/ui";
import { OPENING_INTRO, type OpeningBalancesView as View } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { AccountBalancesTab } from "./account-balances-tab";

/**
 * US-RPT-16–US-RPT-19 — `OpeningBalances`: the account balances on the
 * cutover date, then (as later stories add them) the opening documents and
 * the review. Owner-only.
 */
export function OpeningBalancesView() {
  const [view, setView] = useState<View | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient
      .get<View>("/opening-balances")
      .then(setView)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the opening balances. Refresh to try again."));
  }, []);

  useEffect(() => {
    load();
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
  }, [load]);

  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Settings" }, { label: "Opening balances" }]} title="Opening balances" description={OPENING_INTRO} />
      {error ? (
        <p className="text-[14px] text-overdue">{error}</p>
      ) : !view ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <Tabs defaultValue="accounts">
          <TabsList>
            <TabsTrigger value="accounts">Account balances</TabsTrigger>
          </TabsList>
          <TabsContent value="accounts" className="pt-4">
            <AccountBalancesTab view={view} currency={currency} onSaved={setView} />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
