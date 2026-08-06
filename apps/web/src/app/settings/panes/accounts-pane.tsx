"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { ChartOfAccountsStep, type AccountsByType } from "../../onboarding/steps/chart-of-accounts-step";

/**
 * S-10.1's chart-of-accounts half. `onContinue` is a required prop on
 * ChartOfAccountsStep (it means "advance to next wizard step" there) — in
 * Settings there is nothing to advance to, so a no-op is passed rather than
 * changing the prop to optional, since every rename already saves
 * immediately via onRename and there's no separate "confirm and leave"
 * action needed here. The step's own "Continue" button still renders (its
 * footer isn't conditionally hidden), which reads fine as a no-op
 * affordance since there's nothing left to do after reviewing the list.
 *
 * Relocated from the old routed `settings/accounts/page.tsx` — content/logic unchanged.
 */
export function AccountsPane() {
  const [accounts, setAccounts] = useState<AccountsByType | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<AccountsByType>("/org/accounts").then((res) => {
      if (!cancelled) setAccounts(res);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!accounts) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Chart of accounts</h2>
        <p className="text-[13px] text-on-surface-muted">System accounts can&apos;t be renamed.</p>
      </div>
      <ChartOfAccountsStep
        accounts={accounts}
        onRename={async (accountId, name) => {
          await apiClient.put(`/org/accounts/${accountId}`, { name });
          setAccounts((prev) => {
            if (!prev) return prev;
            const next: AccountsByType = {};
            for (const [type, rows] of Object.entries(prev)) {
              next[type] = rows.map((row) => (row.id === accountId ? { ...row, name } : row));
            }
            return next;
          });
        }}
        onContinue={() => {}}
      />
    </div>
  );
}
