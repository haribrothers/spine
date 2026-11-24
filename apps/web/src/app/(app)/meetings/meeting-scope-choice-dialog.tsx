"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@spine/ui";
import { t as translate, useT } from "../../../lib/i18n";

const ACTION_COPY: Record<"edit" | "delete" | "move", { title: string; description: string }> = {
  edit: { title: translate("meetings.scopeChoice.editTitle"), description: translate("meetings.scopeChoice.editDescription") },
  delete: { title: translate("meetings.scopeChoice.deleteTitle"), description: translate("meetings.scopeChoice.deleteDescription") },
  // PRD S-01.14 — dragging to move, or resizing, a recurring occurrence
  // shares the same This event/All events choice as edit/delete.
  move: { title: translate("meetings.scopeChoice.moveTitle"), description: translate("meetings.scopeChoice.moveDescription") },
};

/**
 * PRD S-01.14 — shown before editing/deleting/moving a recurring meeting
 * (from the quick-view popover, or a drag-move/resize on the calendar
 * grid). Two-way choice only ("This event" vs "All events") — no "this and
 * following" split, per the PRD's explicit v1 scope.
 */
export function MeetingScopeChoiceDialog({
  open,
  action,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  action: "edit" | "delete" | "move";
  onOpenChange: (open: boolean) => void;
  onChoose: (scope: "occurrence" | "series") => void;
}) {
  const t = useT();
  const { title, description } = ACTION_COPY[action];
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("meetings.scopeChoice.cancel")}</AlertDialogCancel>
          <Button variant="secondary" onClick={() => onChoose("occurrence")}>
            {t("meetings.scopeChoice.thisEvent")}
          </Button>
          {/* US-OPS-10: red only when "All events" deletes the series. */}
          <AlertDialogAction variant={action === "delete" ? "danger" : "primary"} onClick={() => onChoose("series")}>
            {t("meetings.scopeChoice.allEvents")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
