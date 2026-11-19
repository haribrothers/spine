"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, Star } from "lucide-react";
import { Card, Input } from "@spine/ui";
import { REPORTS, REPORT_GROUPS, canOpenReport, matchesReportSearch, ownedByOffModule, type ReportEntry } from "@spine/shared";
import { useModules } from "../../../lib/modules-context";
import { apiClient } from "../../../lib/api-client";
import { useCapabilities } from "../../../lib/capabilities-context";
import { useMyRole } from "../../../lib/role-context";
import { useTaxCountry } from "../contacts/contact-gst-fields";
import { useT } from "../../../lib/i18n";

/** US-DASH-14's old `?tab=` links, now pages of their own. */
const OLD_TABS: Record<string, string> = {
  pl: "/reports/profit-and-loss",
  bs: "/reports/balance-sheet",
  tb: "/reports/trial-balance",
  tax: "/reports/tax-summary",
  jobs: "/reports/job-profitability",
};

/**
 * US-RPT-23 — `ReportsCenter`: every report this member can open, grouped,
 * with a search and starred Favourites (kept on the member, so they follow
 * them to every device).
 */
export function ReportsCenter() {
  const t = useT();
  const router = useRouter();
  const tab = useSearchParams().get("tab");
  const role = useMyRole();
  const { capabilities } = useCapabilities();
  const [query, setQuery] = useState("");
  const [favourites, setFavourites] = useState<string[]>([]);

  useEffect(() => {
    if (tab && OLD_TABS[tab]) router.replace(OLD_TABS[tab]);
  }, [tab, router]);

  useEffect(() => {
    apiClient
      .get<{ slugs: string[] }>("/users/me/favourite-reports")
      .then((res) => setFavourites(res.slugs))
      .catch(() => {});
  }, []);

  // US-TAX-16: a country's own reports (GSTR-1) show only to businesses taxed there.
  const taxCountry = useTaxCountry();
  // US-SET-24: a switched-off module's reports (Job profitability) are gone.
  const { modules } = useModules();
  const visible = useMemo(
    () => REPORTS.filter((r) => canOpenReport(r, role, capabilities) && (!r.country || r.country === taxCountry) && !ownedByOffModule(modules, "reports", r.slug)),
    [role, capabilities, taxCountry, modules],
  );
  const shown = visible.filter((r) => matchesReportSearch(r, query));
  const favouriteReports = favourites.map((slug) => visible.find((r) => r.slug === slug)).filter((r): r is ReportEntry => Boolean(r) && matchesReportSearch(r!, query));

  async function toggle(slug: string) {
    const next = favourites.includes(slug) ? favourites.filter((s) => s !== slug) : [...favourites, slug];
    setFavourites(next);
    try {
      setFavourites((await apiClient.put<{ slugs: string[] }>("/users/me/favourite-reports", { slugs: next })).slugs);
    } catch {
      setFavourites(favourites);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative w-full max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
        <Input aria-label={t("reports.center.search")} placeholder={t("reports.center.search")} value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>

      {favouriteReports.length > 0 && (
        <Card className="flex flex-col gap-3" data-testid="report-favourites">
          <h2 className="text-[15px] font-semibold text-on-surface">{t("reports.center.favourites")}</h2>
          <div className="flex flex-wrap gap-2">
            {favouriteReports.map((r) => (
              <Link key={r.slug} href={r.href} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[14px] font-medium text-primary hover:bg-primary/15">
                <Star size={14} className="fill-current" aria-hidden />
                {r.label}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {shown.length === 0 ? (
        <p className="text-[14px] text-on-surface-muted">{t("reports.center.noMatch", { query })}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {REPORT_GROUPS.map((group) => {
            const rows = shown.filter((r) => r.group === group);
            if (!rows.length) return null;
            return (
              // US-RPT-41: on a phone each group is a heading over full-width rows that run edge to edge.
              <Card key={group} className="flex flex-col gap-1 max-md:-mx-4 max-md:gap-0 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0" data-testid="report-group">
                <h2 className="pb-2 text-[15px] font-semibold text-on-surface max-md:px-4 max-md:text-[12px] max-md:uppercase max-md:tracking-wide max-md:text-on-surface-muted">{group}</h2>
                <ul className="flex flex-col max-md:border-b max-md:border-border max-md:bg-surface">
                  {rows.map((r) => {
                    const starred = favourites.includes(r.slug);
                    return (
                      // On a phone the whole row opens the report (the link covers it); the star stays its own 44px button above it.
                      <li key={r.slug} className="flex items-center justify-between border-t border-border py-2 max-md:relative max-md:min-h-11 max-md:py-0 max-md:pl-4 max-md:pr-2">
                        <Link
                          href={r.href}
                          className="text-[14px] text-primary hover:underline max-md:flex-1 max-md:py-3 max-md:text-[15px] max-md:text-on-surface max-md:no-underline max-md:after:absolute max-md:after:inset-0 max-md:after:content-['']"
                        >
                          {r.label}
                        </Link>
                        <button
                          type="button"
                          aria-pressed={starred}
                          aria-label={starred ? t("reports.center.removeFavourite", { name: r.label }) : t("reports.center.addFavourite", { name: r.label })}
                          onClick={() => toggle(r.slug)}
                          className="flex h-8 w-8 items-center justify-center rounded-sm text-on-surface-muted hover:text-due-soon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary max-md:relative max-md:z-[1] max-md:h-11 max-md:w-11"
                        >
                          <Star size={16} className={starred ? "fill-current text-due-soon" : ""} aria-hidden />
                        </button>
                        <ChevronRight size={18} aria-hidden className="hidden shrink-0 text-on-surface-muted max-md:block" />
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
