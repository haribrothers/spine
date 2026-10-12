"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleCheck, CircleMinus, Eye } from "lucide-react";
import { Alert, AlertDescription, Button, Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, Spinner } from "@spine/ui";
import { capabilityGroupCounts, type Capability, type MemberAccess } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { useModules } from "../../../../lib/modules-context";
import { MENU_ICONS } from "../../../../lib/menu-icons";
import type { MemberRow } from "../../../../lib/members";
import { sectionAccessFor } from "../../../../lib/nav-sections";
import { ROLE_LABELS } from "./users-list-state";

/**
 * US-TEAM-20 (D-232) — `UserAccessDrawer`: what someone can open, from the
 * same effective list the API enforces for them — the sections of Spine
 * as their sidebar shows them, and how many permissions of each group they
 * have, with links to change it on their Teams.
 */
export function UserAccessDrawer({ member, onOpenChange, onManageTeams }: { member: MemberRow | null; onOpenChange: (open: boolean) => void; onManageTeams: (member: MemberRow) => void }) {
  const [access, setAccess] = useState<MemberAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { modules } = useModules();

  useEffect(() => {
    if (!member) return;
    setAccess(null);
    setError(null);
    apiClient
      .get<MemberAccess>(`/org/members/${member.id}/access`)
      .then(setAccess)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load what they can open. Try again."));
  }, [member]);

  const caps = access?.capabilities as Partial<Record<Capability, boolean>> | undefined;
  // Every section the business uses, ticked where their sidebar shows it.
  // Work there, only view (reading needs no permission), or can't open.
  const sections = access ? sectionAccessFor(access.role, caps ?? null, modules) : [];

  return (
    <Drawer open={member !== null} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>What {member?.name} can open</DrawerTitle>
          <DrawerDescription>
            {access?.role === "owner"
              ? "Owner · Owners can open everything, including Users, Teams and Settings."
              : access?.role === "field"
                ? "Field · Field access is fixed: the jobs they're assigned to, their meetings and their own expenses — no money."
                : access
                  ? access.teams.length
                    ? `Staff · on ${access.teams.map((t) => t.name).join(" and ")}${access.teams.length > 1 ? " — everything any of them allows." : "."}`
                    : "Staff · on no Team — they can't open anything until you add them to one."
                  : member
                    ? ROLE_LABELS[member.role]
                    : ""}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6" data-testid="user-access-drawer">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!access && !error && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
          {access && (
            <>
              <section className="flex flex-col gap-2">
                <h3 className="text-[13px] font-semibold text-on-surface">Sections</h3>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13.5px]" aria-label="Sections">
                  {sections.map((item) => {
                    const Icon = item.access === "work" ? CircleCheck : item.access === "view" ? Eye : CircleMinus;
                    return (
                      <li key={item.href} className={item.access === "work" ? "flex items-center gap-2 text-on-surface" : "flex items-center gap-2 text-on-surface-muted"} data-access={item.access}>
                        <Icon size={15} aria-hidden className={item.access === "work" ? "text-paid" : undefined} />
                        {item.label}
                        {item.access === "view" && <span className="text-[12px]">· view only</span>}
                        <span className="sr-only">{item.access === "work" ? " — can work here" : item.access === "view" ? " — view only" : " — can't open"}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-on-surface-muted" aria-hidden>
                  <span className="flex items-center gap-1"><CircleCheck size={13} className="text-paid" />Can work here</span>
                  <span className="flex items-center gap-1"><Eye size={13} />View only — reading needs no permission</span>
                  <span className="flex items-center gap-1"><CircleMinus size={13} />Can&apos;t open</span>
                </p>
              </section>
              {access.role === "staff" && (
                <section className="flex flex-col gap-1">
                  <h3 className="text-[13px] font-semibold text-on-surface">Permissions by group</h3>
                  <dl className="flex flex-col text-[13.5px]" data-testid="access-groups">
                    {capabilityGroupCounts(access.capabilities).map((g) => (
                      <div key={g.group} className="flex justify-between border-t border-dashed border-border py-1.5 first:border-t-0">
                        <dt className="text-on-surface">{g.group}</dt>
                        <dd className="font-medium tabular-nums text-on-surface">
                          {g.granted} of {g.total}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              {access.role === "staff" && member && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-[13px] font-semibold text-on-surface">Change what they can do</h3>
                  <div className="flex flex-col items-start gap-1.5 text-[13.5px]">
                    {access.teams.map((t) => (
                      <Link key={t.id} href={`/team/teams/${t.id}`} className="font-medium text-primary hover:underline">
                        Edit on {t.name} →
                      </Link>
                    ))}
                    <Button variant="secondary" size="sm" onClick={() => onManageTeams(member)}>
                      <MENU_ICONS.manageTeams size={14} aria-hidden />
                      Manage Teams
                    </Button>
                  </div>
                </section>
              )}
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
