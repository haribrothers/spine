"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShellHeader, Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@spine/ui";
import { OPENING_INTRO, type OpeningBalancesView as View } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { AccountBalancesTab } from "./account-balances-tab";
import { CustomerCreditTab } from "./customer-credit-tab";
import { OpeningInvoicesTab } from "./opening-invoices-tab";
import { OpeningBillsTab } from "./opening-bills-tab";
import { VendorCreditTab } from "./vendor-credit-tab";
import { ReviewTab } from "./review-tab";

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
            <TabsTrigger value="invoices">Customer invoices</TabsTrigger>
            <TabsTrigger value="credit">Customer credit</TabsTrigger>
            <TabsTrigger value="bills">Vendor bills</TabsTrigger>
            <TabsTrigger value="vendor-credits">Vendor credits</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>
          <TabsContent value="accounts" className="pt-4">
            <AccountBalancesTab view={view} currency={currency} onSaved={setView} />
          </TabsContent>
          <TabsContent value="invoices" className="pt-4">
            <OpeningInvoicesTab currency={currency} locked={view.status === "locked"} onChanged={load} />
          </TabsContent>
          <TabsContent value="credit" className="pt-4">
            <CustomerCreditTab currency={currency} locked={view.status === "locked"} onChanged={load} />
          </TabsContent>
          <TabsContent value="bills" className="pt-4">
            <OpeningBillsTab currency={currency} locked={view.status === "locked"} onChanged={load} />
          </TabsContent>
          <TabsContent value="vendor-credits" className="pt-4">
            <VendorCreditTab currency={currency} locked={view.status === "locked"} onChanged={load} />
          </TabsContent>
          <TabsContent value="review" className="pt-4">
            <ReviewTab view={view} currency={currency} onChanged={setView} />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
