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
  ListRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@spine/ui";
import { LOST_REASON_LABELS, type LeadStage } from "@spine/shared";
import { Calendar, Check, Ellipsis, Hourglass, ListTodo, MapPin, NotebookPen, Phone } from "lucide-react";
import type { ActivityType, Lead } from "../contacts/types";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { t as translate, useT } from "../../../lib/i18n";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { coldDays, daysInStage, daysLabel, initials, isOverdue } from "./pipeline-state";

const FOLLOW_UP_ICON: Record<ActivityType, typeof Phone> = { call: Phone, meeting: MapPin, note: NotebookPen, task: ListTodo };
const FOLLOW_UP_LABEL: Record<ActivityType, string> = {
  call: translate("leads.card.followUpType.call"),
  meeting: translate("leads.card.followUpType.meeting"),
  note: translate("leads.card.followUpType.note"),
  task: translate("leads.card.followUpType.task"),
};

/** "Tomorrow 10:00", "Fri 16 Oct" — the follow-up's day, with its time when it has one. */
export function followUpWhen(dueAt: string, now: number): string {
  const due = new Date(dueAt);
  const today = new Date(now);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(due) - startOf(today)) / 86_400_000);
  const hasTime = due.getHours() !== 0 || due.getMinutes() !== 0;
  const time = hasTime ? ` ${due.toLocaleTimeString(orgLocaleTag(), { hour: "2-digit", minute: "2-digit", hour12: false })}` : "";
  if (dayDiff === 0) return translate("leads.card.today", { time });
  if (dayDiff === 1) return translate("leads.card.tomorrow", { time });
  return due.toLocaleDateString(orgLocaleTag(), { weekday: "short", day: "numeric", month: "short" });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(orgLocaleTag(), { day: "numeric", month: "short" });
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
  const t = useT();
  const menuProps = { lead, stages, canDelete, canMove, menuOpen, onMenuOpenChange, onOpen, onMove, onDelete };
  const title = lead.title || contactName || t("leads.card.untitled");
  const showContact = Boolean(lead.title && contactName);
  const cold = coldDays(lead, now);
  const overdue = isOverdue(lead, now);
  const followUp = lead.stageKind === "open" ? lead.nextFollowUp : null;
  const FollowUpIcon = followUp ? FOLLOW_UP_ICON[followUp.type] : Calendar;
  const days = daysInStage(lead, now);
  const meta = lead.stageKind === "won" ? t("leads.card.wonOn", { date: shortDate(lead.stageChangedAt) }) : lead.stageKind === "lost" ? t("leads.card.lostOn", { date: shortDate(lead.stageChangedAt) }) : daysLabel(days);

  return (
    <KanbanCard
      id={lead.id}
      data-lead={lead.id}
      label={`${title}${showContact ? `, ${contactName}` : ""}. ${meta}. ${ownerName ? t("leads.card.owner", { name: ownerName }) : t("leads.card.unassigned")}`}
      onOpen={onOpen}
      onMenuKey={() => onMenuOpenChange(true)}
      className="gap-1.5 border-border"
      menu={
        <LeadMenu {...menuProps} title={title} />
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
            <b className="font-semibold">{FOLLOW_UP_LABEL[followUp.type]}</b> · {overdue ? t("leads.card.overdueOn", { date: shortDate(followUp.dueAt) }) : followUpWhen(followUp.dueAt, now)}
          </span>
        </span>
      )}
      {cold !== null && (
        <span className="flex items-center gap-1.5 self-start rounded-md bg-due-soon-bg px-1.5 py-0.5 text-[11.5px] font-medium text-due-soon" data-testid="lead-cold">
          <Hourglass size={12} aria-hidden />
          {t("leads.card.noActivity", { days: cold })}
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

/** A lead's ⋯ menu: open it, move it to another stage, delete it. Shared by the card and the phone row. */
function LeadMenu({
  lead,
  title,
  stages,
  canDelete,
  canMove,
  menuOpen,
  onMenuOpenChange,
  onOpen,
  onMove,
  onDelete,
  large = false,
}: Pick<LeadCardProps, "lead" | "stages" | "canDelete" | "canMove" | "menuOpen" | "onMenuOpenChange" | "onOpen" | "onMove" | "onDelete"> & { title: string; large?: boolean }) {
  const t = useT();
  return (
    <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
      <CardMenuTrigger lead={title} large={large} />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={onOpen}>
          <MENU_ICONS.openDrawer aria-hidden />
          {t("leads.card.open")}
        </DropdownMenuItem>
        {canMove && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <MENU_ICONS.moveTo aria-hidden />
              {t("leads.card.moveToMenu")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              <DropdownMenuLabel>{t("leads.card.moveTo")}</DropdownMenuLabel>
              {stages.map((stage) => {
                const current = stage.id === lead.stageId;
                return (
                  <DropdownMenuItem key={stage.id} disabled={current} onSelect={() => onMove(stage)}>
                    {stage.name}
                    {current && <Check size={14} aria-label={t("leads.card.currentStage")} className="ml-auto" />}
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
              {t("leads.card.delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * US-OPS-57 (D-283) — a lead as a row on a phone: its title (tap to open it), the contact and
 * source under it, the value on the right with the next follow-up (or how long it's been in
 * its stage), and its ⋯ with Move to and Delete.
 */
export function LeadRow({ lead, contactName, stages, now, showValue, showSource, canDelete, canMove, menuOpen, onMenuOpenChange, onOpen, onMove, onDelete }: LeadCardProps) {
  const t = useT();
  const title = lead.title || contactName || t("leads.card.untitled");
  const overdue = isOverdue(lead, now);
  const followUp = lead.stageKind === "open" ? lead.nextFollowUp : null;
  const days = daysInStage(lead, now);
  const meta = lead.stageKind === "won" ? t("leads.card.wonOn", { date: shortDate(lead.stageChangedAt) }) : lead.stageKind === "lost" ? t("leads.card.lostOn", { date: shortDate(lead.stageChangedAt) }) : daysLabel(days);
  const subtitle = [lead.title ? contactName : null, showSource ? lead.source : null].filter(Boolean).join(" · ");
  const note = followUp ? `${FOLLOW_UP_LABEL[followUp.type]} · ${overdue ? t("leads.card.overdueOn", { date: shortDate(followUp.dueAt) }) : followUpWhen(followUp.dueAt, now)}` : meta;
  return (
    <ListRow
      data-testid="lead-row"
      title={
        <button type="button" onClick={onOpen} className="max-w-full truncate text-left" data-lead={lead.id}>
          {title}
        </button>
      }
      subtitle={subtitle || undefined}
      trailing={showValue ? formatMoney(lead.valueAmount, lead.valueCurrency) : undefined}
      trailingSub={<span className={overdue ? "text-overdue" : undefined}>{note}</span>}
      action={<LeadMenu lead={lead} title={title} stages={stages} canDelete={canDelete} canMove={canMove} menuOpen={menuOpen} onMenuOpenChange={onMenuOpenChange} onOpen={onOpen} onMove={onMove} onDelete={onDelete} large />}
    />
  );
}

/** The owner's initials, with their name on hover; a dashed "—" when unassigned. */
function OwnerChip({ name }: { name: string | null }) {
  const t = useT();
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
      <TooltipContent>{name ?? t("leads.card.unassigned")}</TooltipContent>
    </Tooltip>
  );
}

/** The card's "⋯" button. */
function CardMenuTrigger({ lead, large = false }: { lead: string; large?: boolean }) {
  const t = useT();
  return (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className={large ? "h-11 w-11 text-on-surface-muted" : "h-7 w-7 text-on-surface-muted data-[state=open]:bg-surface-sunken data-[state=open]:text-on-surface"} aria-label={t("leads.card.actionsFor", { lead })}>
        <Ellipsis size={15} aria-hidden />
      </Button>
    </DropdownMenuTrigger>
  );
}
