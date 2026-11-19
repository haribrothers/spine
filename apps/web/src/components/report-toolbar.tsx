"use client";

import { ReportToolbar as UiReportToolbar, type ReportToolbarProps } from "@spine/ui";
import { PhoneMoreActions } from "../lib/phone-bar";

/**
 * US-RPT-41 — `@spine/ui`'s `ReportToolbar` with the report's actions (Export, Tax payment)
 * under the top bar's ⋯ on a phone; from 768px up they're on the right, as before.
 */
export function ReportToolbar({ actions, ...props }: ReportToolbarProps) {
  return <UiReportToolbar {...props} actions={actions ? <PhoneMoreActions>{actions}</PhoneMoreActions> : actions} />;
}
