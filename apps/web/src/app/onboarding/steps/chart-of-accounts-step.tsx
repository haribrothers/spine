"use client";

import { useState } from "react";
import { Badge, Button, Input, Spinner } from "@spine/ui";
import { t as translate, useT } from "../../../lib/i18n";

export interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  isSystem: boolean;
}

export type AccountsByType = Record<string, AccountRow[]>;

const TYPE_LABELS: Record<string, string> = {
  asset: translate("onboarding.accountTypes.asset"),
  liability: translate("onboarding.accountTypes.liability"),
  equity: translate("onboarding.accountTypes.equity"),
  income: translate("onboarding.accountTypes.income"),
  expense: translate("onboarding.accountTypes.expense"),
};

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];

export interface ChartOfAccountsStepProps {
  accounts: AccountsByType;
  /** Called once per renamed account, immediately — there's no single "save all" here since accounts persist individually. */
  onRename: (accountId: string, name: string) => Promise<void>;
  onContinue: () => void;
  onSkip?: () => void;
  /** Rendered on the button — defaults to the wizard's "Continue"; Settings passes "Save" (US-SET-14). */
  saveLabel?: string;
}

/**
 * CoA-review step (S-12.6). Judgment call (documented per task brief):
 * `accounts` has no isHidden/isActive column and this pass doesn't add
 * hide/delete — system accounts (AR, AP, tax, retention, etc.) render
 * read-only with a "System" badge; non-system accounts get an inline
 * rename. Nothing here can be hidden or deleted in this pass.
 */
export function ChartOfAccountsStep({ accounts, onRename, onContinue, onSkip, saveLabel }: ChartOfAccountsStepProps) {
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function commitRename(accountId: string) {
    setSavingId(accountId);
    try {
      await onRename(accountId, draftName);
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="max-h-96 overflow-y-auto rounded-md border border-border-strong bg-surface">
        {TYPE_ORDER.map((type) => {
          const rows = accounts[type] ?? [];
          if (rows.length === 0) return null;
          return (
            <div key={type}>
              <div className="sticky top-0 border-b border-border-strong bg-surface-muted px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-on-surface-muted">
                {TYPE_LABELS[type] ?? type}
              </div>
              {rows.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 border-b border-border px-3 py-2 text-[13px] last:border-0"
                >
                  <span className="w-14 shrink-0 font-mono text-on-surface-muted">{account.code}</span>
                  {editingId === account.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="h-8 flex-1"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => commitRename(account.id)} disabled={savingId === account.id}>
                        {savingId === account.id ? <Spinner size="sm" /> : t("onboarding.common.save")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        {t("onboarding.common.cancel")}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-on-surface">{account.name}</span>
                      {account.isSystem ? (
                        <Badge>{t("onboarding.accounts.system")}</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(account.id);
                            setDraftName(account.name);
                          }}
                        >
                          {t("onboarding.accounts.rename")}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {onSkip && (
          <Button type="button" variant="ghost" onClick={onSkip}>
            {t("onboarding.common.skipToDashboard")}
          </Button>
        )}
        <Button onClick={onContinue} className="ml-auto">
          {saveLabel ?? t("onboarding.common.continue")}
        </Button>
      </div>
    </div>
  );
}
