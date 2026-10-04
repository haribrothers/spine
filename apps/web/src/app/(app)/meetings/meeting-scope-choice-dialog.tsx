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

const ACTION_COPY: Record<"edit" | "delete" | "move", { title: string; verb: string }> = {
  edit: { title: "Edit recurring event", verb: "edit" },
  delete: { title: "Delete recurring event", verb: "delete" },
  // PRD S-01.14 — dragging to move, or resizing, a recurring occurrence
  // shares the same This event/All events choice as edit/delete.
  move: { title: "Move recurring event", verb: "move" },
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
  const { title, verb } = ACTION_COPY[action];
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            This is a recurring event. Do you want to {verb} just this event, or all events in the series?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="secondary" onClick={() => onChoose("occurrence")}>
            This event
          </Button>
          {/* US-OPS-10: red only when "All events" deletes the series. */}
          <AlertDialogAction variant={action === "delete" ? "danger" : "primary"} onClick={() => onChoose("series")}>
            All events
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
