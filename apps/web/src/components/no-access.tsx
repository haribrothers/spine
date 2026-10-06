"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, EmptyState } from "@spine/ui";
import { Lock } from "lucide-react";
import { apiClient } from "../lib/api-client";

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

  const ask = owners ? `ask an owner — ${owners} —` : "ask an owner";
  const description = message
    ? message
    : ownerOnly
    ? `${pageName} is only available to owners.`
    : fixedRole
      ? `Your account can't open this page. If you need it for your work, ${ask.replace(/ —$/, "")}.`
      : `Your account can't open this page. If you need it for your work, ${ask} to change your team's permissions.`;

  return (
    <EmptyState
      data-testid="no-access"
      className="mx-auto max-w-[480px] py-24"
      icon={<Lock />}
      title={`You don't have access to ${pageName}`}
      description={description}
      action={
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      }
    />
  );
}
