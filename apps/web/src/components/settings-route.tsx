"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SettingsDialog, firstSettingsPane } from "./settings-dialog";

const withSettings = (pathname: string, params: URLSearchParams, key: string | null) => {
  const next = new URLSearchParams(params.toString());
  if (key) next.set("settings", key);
  else next.delete("settings");
  const qs = next.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`;
};

/**
 * US-SET-33 (D-236) — Settings lives in the address: `?settings=<pane>` on
 * any page opens it on that pane (refresh, Back and links keep it), and
 * closing it takes the parameter away. Mounted once in the app layout.
 */
export function SettingsRoute({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";
  const params = useSearchParams();
  const key = params?.get("settings") ?? null;
  const setKey = useCallback(
    (next: string | null) => router.replace(withSettings(pathname, new URLSearchParams(params?.toString() ?? ""), next), { scroll: false }),
    [router, pathname, params],
  );
  return <SettingsDialog open={key !== null} onOpenChange={(open) => !open && setKey(null)} isOwner={isOwner} activeKey={key} onActiveKeyChange={setKey} />;
}

/** Opens Settings on a pane (its first one by default), as a new step in the browser's history. */
export function useOpenSettings(isOwner: boolean): (key?: string) => void {
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";
  const params = useSearchParams();
  return useCallback(
    (key?: string) => router.push(withSettings(pathname, new URLSearchParams(params?.toString() ?? ""), key ?? firstSettingsPane(isOwner)), { scroll: false }),
    [router, pathname, params, isOwner],
  );
}
