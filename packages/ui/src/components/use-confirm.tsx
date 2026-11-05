"use client";

import { useCallback, useRef, useState } from "react";
import { useT } from "../lib/i18n";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./alert-dialog";

export interface ConfirmOptions {
  /** A question: "Record this bill?" */
  title: string;
  /** What happens to the person's data, and whether it can be undone. */
  description: React.ReactNode;
  /** The verb on the button: "Record bill". */
  confirmLabel: string;
  cancelLabel?: string;
  /** A red button, for deleting or removing. */
  danger?: boolean;
}

/**
 * D-218 — a major action asks first: issuing, recording or voiding a
 * document, deleting or removing something, emailing a customer, or a bulk
 * change. `await confirm({ … })` opens an AlertDialog that says what happens
 * to the person's data, and resolves `true` when they press the verb,
 * `false` on "Go back", Esc or a click outside. Render `dialog` once in the
 * component. The verb is primary unless it deletes, voids or removes (D-058).
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title: "Record this bill?", description: "…", confirmLabel: "Record bill" }))) return;
 */
export function useConfirm() {
  const t = useT();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  const dialog = (
    <AlertDialog open={options !== null} onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          <AlertDialogDescription data-testid="confirm-description">{options?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{options?.cancelLabel ?? t("ui.confirm.goBack")}</AlertDialogCancel>
          <AlertDialogAction variant={options?.danger ? "danger" : "primary"} onClick={() => close(true)}>
            {options?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
