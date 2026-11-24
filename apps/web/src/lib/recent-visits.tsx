"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { SearchGroupType } from "@spine/shared";
import { apiClient } from "./api-client";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Record pages, by their address. */
const PAGES: [RegExp, SearchGroupType][] = [
  [new RegExp(`^/contacts/(${UUID})$`, "i"), "contacts"],
  [new RegExp(`^/quotes/(${UUID})$`, "i"), "quotes"],
  [new RegExp(`^/jobs/(${UUID})$`, "i"), "jobs"],
  [new RegExp(`^/invoices/(${UUID})$`, "i"), "invoices"],
  [new RegExp(`^/credit-notes/(${UUID})$`, "i"), "credit_notes"],
  [new RegExp(`^/payments/(${UUID})$`, "i"), "payments"],
  [new RegExp(`^/vendor-bills/(${UUID})$`, "i"), "vendor_bills"],
  [new RegExp(`^/vendor-credits/(${UUID})$`, "i"), "vendor_credits"],
  [new RegExp(`^/vendor-payments/(${UUID})$`, "i"), "vendor_payments"],
  [new RegExp(`^/expenses/(${UUID})$`, "i"), "expenses"],
];

/** Records that open over a list, by the list and its parameter. */
const DRAWERS: [string, string, SearchGroupType][] = [
  ["/leads", "lead", "leads"],
  ["/meetings", "id", "meetings"],
  ["/catalog", "item", "catalog_items"],
  ["/expenses", "id", "expenses"],
];

/** US-OPS-39 — the record an address opens, if it opens one: "/invoices/<id>", "/leads?lead=<id>", "/catalog?item=<id>". */
export function recordFromLocation(pathname: string, search: URLSearchParams): { type: SearchGroupType; id: string } | null {
  for (const [pattern, type] of PAGES) {
    const m = pathname.match(pattern);
    if (m) return { type, id: m[1]!.toLowerCase() };
  }
  for (const [path, param, type] of DRAWERS) {
    const id = search.get(param);
    if (pathname === path && id && new RegExp(`^${UUID}$`, "i").test(id)) return { type, id: id.toLowerCase() };
  }
  return null;
}

/**
 * US-OPS-39 (D-238) — tells the server each record this person opens, from
 * search, a list, a link or the dashboard, so search can show it under
 * Recent on any device. Once per record per visit; a failure is ignored
 * (it's a convenience, never in the way).
 */
export function RecentVisits() {
  const pathname = usePathname();
  const params = useSearchParams();
  const last = useRef("");
  useEffect(() => {
    const record = recordFromLocation(pathname ?? "", new URLSearchParams(params?.toString() ?? ""));
    if (!record) {
      last.current = "";
      return;
    }
    const key = `${record.type}:${record.id}`;
    if (key === last.current) return;
    last.current = key;
    apiClient.post("/search/recent", record).catch(() => {});
  }, [pathname, params]);
  return null;
}
