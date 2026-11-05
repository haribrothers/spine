"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, StatusChip } from "@spine/ui";
import { OPENING_INTRO, type OpeningBalancesView } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";
import { orgLocaleTag } from "../../../lib/money";

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric", year: "numeric" });

/** US-RPT-16 — Settings › Opening balances: where things stand, and the way to the page itself. */
export function OpeningBalancesPane({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  const [view, setView] = useState<OpeningBalancesView | null>(null);

  useEffect(() => {
    apiClient.get<OpeningBalancesView>("/opening-balances").then(setView).catch(() => setView(null));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">{t("settings.openingBalances.title")}</h2>
        <p className="text-[13px] text-on-surface-muted">{OPENING_INTRO}</p>
      </div>
      {view && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-on-surface">
          {view.status === "locked" ? (
            <StatusChip status="paid">{t("settings.openingBalances.locked")}</StatusChip>
          ) : view.status === "draft" ? (
            <StatusChip status="due-soon">{t("settings.openingBalances.draft")}</StatusChip>
          ) : (
            <StatusChip status="draft">{t("settings.openingBalances.notStarted")}</StatusChip>
          )}
          {view.status !== "not_started" && <span>{t("settings.openingBalances.cutoverDate", { date: day(view.cutoverDate) })}</span>}
        </div>
      )}
      <div>
        <Button asChild onClick={onOpen}>
          <Link href="/opening-balances">{view?.status === "not_started" ? t("settings.openingBalances.bringIn") : t("settings.openingBalances.open")}</Link>
        </Button>
      </div>
    </div>
  );
}
