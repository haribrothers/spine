"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  KanbanCard,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@spine/ui";
import { LOST_REASON_LABELS, type LeadStage } from "@spine/shared";
import { Calendar, Check, Ellipsis, Hourglass, ListTodo, MapPin, NotebookPen, Phone } from "lucide-react";
import type { ActivityType, Lead } from "../contacts/types";
import { formatMoney } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { coldDays, daysInStage, daysLabel, initials, isOverdue } from "./pipeline-state";

const FOLLOW_UP_ICON: Record<ActivityType, typeof Phone> = { call: Phone, meeting: MapPin, note: NotebookPen, task: ListTodo };
const FOLLOW_UP_LABEL: Record<ActivityType, string> = { call: "Call", meeting: "Meeting", note: "Note", task: "Task" };

/** "Tomorrow 10:00", "Fri 16 Oct" — the follow-up's day, with its time when it has one. */
export function followUpWhen(dueAt: string, now: number): string {
  const due = new Date(dueAt);
  const today = new Date(now);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(due) - startOf(today)) / 86_400_000);
  const hasTime = due.getHours() !== 0 || due.getMinutes() !== 0;
  const time = hasTime ? ` ${due.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}` : "";
  if (dayDiff === 0) return `Today${time}`;
  if (dayDiff === 1) return `Tomorrow${time}`;
  return due.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export interface LeadCardProps {
  lead: Lead;
  contactName: string | null;
  ownerName: string | null;
  stages: LeadStage[];
  now: number;
  showValue: boolean;
  showSource: boolean;
  canDelete: boolean;
  canMove: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onOpen: () => void;
  onMove: (stage: LeadStage) => void;
  onDelete: () => void;
}

/**
 * US-CRM-25 (D-211) — a lead on the board: title (or the contact's name,
 * once), contact, value, days in stage and the owner, then the next
 * follow-up and a nudge for a lead gone cold. Lost cards show their reason
 * and won cards when they were won. The "⋯" menu opens, moves (keyboard
 * and touch) or deletes it.
 */
export function LeadCard({ lead, contactName, ownerName, stages, now, showValue, showSource, canDelete, canMove, menuOpen, onMenuOpenChange, onOpen, onMove, onDelete }: LeadCardProps) {
  const title = lead.title || contactName || "Untitled lead";
  const showContact = Boolean(lead.title && contactName);
  const cold = coldDays(lead, now);
  const overdue = isOverdue(lead, now);
  const followUp = lead.stageKind === "open" ? lead.nextFollowUp : null;
  const FollowUpIcon = followUp ? FOLLOW_UP_ICON[followUp.type] : Calendar;
  const days = daysInStage(lead, now);
  const meta = lead.stageKind === "won" ? `Won ${shortDate(lead.stageChangedAt)}` : lead.stageKind === "lost" ? `Lost ${shortDate(lead.stageChangedAt)}` : daysLabel(days);

  return (
    <KanbanCard
      id={lead.id}
      data-lead={lead.id}
      label={`${title}${showContact ? `, ${contactName}` : ""}. ${meta}. ${ownerName ? `Owner ${ownerName}` : "Unassigned"}`}
      onOpen={onOpen}
      onMenuKey={() => onMenuOpenChange(true)}
      className="gap-1.5 border-border"
      menu={
        <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
          <CardMenuTrigger lead={title} />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onOpen}>
              <MENU_ICONS.openDrawer aria-hidden />
              Open
            </DropdownMenuItem>
            {canMove && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <MENU_ICONS.moveTo aria-hidden />
                  Move to…
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  <DropdownMenuLabel>Move to</DropdownMenuLabel>
                  {stages.map((stage) => {
                    const current = stage.id === lead.stageId;
                    return (
                      <DropdownMenuItem key={stage.id} disabled={current} onSelect={() => onMove(stage)}>
                        {stage.name}
                        {current && <Check size={14} aria-label="Current stage" className="ml-auto" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={onDelete}>
                  <MENU_ICONS.delete aria-hidden />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <span className="line-clamp-2 pr-7 text-[13.5px] font-semibold leading-snug text-on-surface">{title}</span>
      {showContact && <span className="truncate text-[12.5px] text-on-surface-muted">{contactName}</span>}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-0.5">
        {showValue && <span className="text-[13px] font-semibold tabular-nums text-on-surface">{formatMoney(lead.valueAmount, lead.valueCurrency)}</span>}
        <span className="ml-auto flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-on-surface-muted">
          {meta}
          <OwnerChip name={ownerName} />
        </span>
      </div>
      {showSource && lead.source && <span className="self-start rounded-md border border-border bg-surface-sunken px-1.5 text-[11px] text-on-surface-muted">{lead.source}</span>}
      {followUp && (
        <span className={cn("flex items-center gap-1.5 border-t border-border pt-1.5 text-[11.5px] font-medium", overdue ? "text-overdue" : "text-on-surface")} data-testid="lead-follow-up">
          <FollowUpIcon size={13} aria-hidden className={overdue ? "text-overdue" : "text-on-surface-muted"} />
          <span>
            <b className="font-semibold">{FOLLOW_UP_LABEL[followUp.type]}</b> · {overdue ? `Overdue · ${shortDate(followUp.dueAt)}` : followUpWhen(followUp.dueAt, now)}
          </span>
        </span>
      )}
      {cold !== null && (
        <span className="flex items-center gap-1.5 self-start rounded-md bg-due-soon-bg px-1.5 py-0.5 text-[11.5px] font-medium text-due-soon" data-testid="lead-cold">
          <Hourglass size={12} aria-hidden />
          No activity for {cold} days
        </span>
      )}
      {lead.stageKind === "lost" && lead.lostReason && (
        <span className="self-start rounded-md border border-border bg-surface-sunken px-1.5 py-0.5 text-[11.5px] font-medium text-on-surface-muted" data-testid="lead-lost-reason">
          {LOST_REASON_LABELS[lead.lostReason]}
        </span>
      )}
    </KanbanCard>
  );
}

/** The owner's initials, with their name on hover; a dashed "—" when unassigned. */
function OwnerChip({ name }: { name: string | null }) {
  const chip = (
    <span
      className={cn(
        "pointer-events-auto inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
        name ? "bg-info-bg text-primary" : "border border-dashed border-border-strong bg-surface-sunken text-on-surface-muted",
      )}
      data-testid="lead-owner"
    >
      {name ? initials(name) : "—"}
    </span>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent>{name ?? "Unassigned"}</TooltipContent>
    </Tooltip>
  );
}

/** The card's "⋯" button. */
function CardMenuTrigger({ lead }: { lead: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-on-surface-muted data-[state=open]:bg-surface-sunken data-[state=open]:text-on-surface" aria-label={`Actions for ${lead}`}>
        <Ellipsis size={15} aria-hidden />
      </Button>
    </DropdownMenuTrigger>
  );
}
