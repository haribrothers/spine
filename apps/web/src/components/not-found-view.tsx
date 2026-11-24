"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@spine/ui";
import { t as translate, useT } from "../lib/i18n";

export const NOT_FOUND_MESSAGE = translate("common.notFound.message");

/**
 * US-OPS-11 (finding G8) — an unknown address, or a record that isn't in
 * this organisation. Shown inside the app shell (`(app)/not-found.tsx`), so
 * the navigation is still there.
 */
export function NotFoundView() {
  const t = useT();
  const router = useRouter();
  return (
    <div data-testid="not-found" className="mx-auto flex max-w-[480px] flex-col items-center gap-3 py-24 text-center">
      <p className="text-[13px] font-medium text-on-surface-muted">{t("common.notFound.code")}</p>
      <h1 className="text-[22px] font-semibold text-on-surface">{t("common.notFound.title")}</h1>
      <p className="text-[14px] text-on-surface-muted">{t("common.notFound.message")}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard">{t("common.notFound.goToDashboard")}</Link>
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>
          {t("common.notFound.goBack")}
        </Button>
      </div>
    </div>
  );
}
