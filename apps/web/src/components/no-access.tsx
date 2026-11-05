"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, EmptyState } from "@spine/ui";
import { Lock } from "lucide-react";
import { apiClient } from "../lib/api-client";
import { useT } from "../lib/i18n";

interface MemberRow {
  name: string | null;
  role: string;
  isActive: boolean;
}

/**
 * US-OPS-12 — shown instead of a page (or an Owner-only report tab) the
 * person can't open. Nothing from the refused page is loaded. Names the
 * owners to ask; for pages only Owners can ever open, it says so instead
 * of suggesting a Team change. Field roles are fixed, so the Team clause
 * is left out for them too.
 */
export function NoAccess({ pageName, ownerOnly = false, fixedRole = false, message }: { pageName: string; ownerOnly?: boolean; fixedRole?: boolean; message?: string }) {
  const t = useT();
  const [owners, setOwners] = useState<string | null>(null);

  useEffect(() => {
    if (ownerOnly) return;
    apiClient
      .get<MemberRow[]>("/org/members")
      .then((rows) => {
        const names = rows.filter((m) => m.role === "owner" && m.isActive && m.name).map((m) => m.name!);
        setOwners(names.length ? names.join(", ") : null);
      })
      .catch(() => setOwners(null));
  }, [ownerOnly]);

  const ask = owners ? t("common.noAccess.askNamed", { owners }) : t("common.noAccess.ask");
  const description = message
    ? message
    : ownerOnly
    ? t("common.noAccess.ownerOnly", { page: pageName })
    : fixedRole
      ? t("common.noAccess.fixedRole", { ask: ask.replace(/ —$/, "") })
      : t("common.noAccess.teamRole", { ask });

  return (
    <EmptyState
      data-testid="no-access"
      className="mx-auto max-w-[480px] py-24"
      icon={<Lock />}
      title={t("common.noAccess.title", { page: pageName })}
      description={description}
      action={
        <Button asChild>
          <Link href="/dashboard">{t("common.actions.goToDashboard")}</Link>
        </Button>
      }
    />
  );
}
