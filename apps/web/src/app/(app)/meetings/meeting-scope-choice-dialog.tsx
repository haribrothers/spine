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

/**
 * PRD S-01.14 — shown before editing/deleting a recurring meeting from the
 * quick-view popover. Two-way choice only ("This event" vs "All events") —
 * no "this and following" split, per the PRD's explicit v1 scope.
 */
export function MeetingScopeChoiceDialog({
  open,
  action,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  action: "edit" | "delete";
  onOpenChange: (open: boolean) => void;
  onChoose: (scope: "occurrence" | "series") => void;
}) {
  const verb = action === "edit" ? "edit" : "delete";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{action === "edit" ? "Edit recurring event" : "Delete recurring event"}</AlertDialogTitle>
          <AlertDialogDescription>
            This is a recurring event. Do you want to {verb} just this event, or all events in the series?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="secondary" onClick={() => onChoose("occurrence")}>
            This event
          </Button>
          <AlertDialogAction onClick={() => onChoose("series")}>All events</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
