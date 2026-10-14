"use client";

import Link from "next/link";
import { Alert, AlertDescription } from "@spine/ui";
import { XCircle } from "lucide-react";
import { useMyRole } from "../lib/role-context";

/**
 * A quote's or invoice's "Email failed" message (S-05.7, US-SET-28): the
 * last error, or that an Owner cancelled it in the email log; Owners get a
 * link to the log, filtered to this record (US-SET-27, D-220).
 */
export function EmailFailedAlert({ error, recordId }: { error: string | null; recordId: string }) {
  const owner = useMyRole() === "owner";
  const cancelled = error === "Cancelled";
  return (
    <Alert variant="critical" data-testid="email-failed">
      <AlertDescription className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 font-medium">
          <XCircle size={14} className="shrink-0" />
          {cancelled ? "Email not sent — cancelled" : "Email delivery failed"}
        </span>
        {cancelled ? <span className="text-[13px]">It was cancelled in the email log before it went out. Email it again to send it.</span> : error && <span className="text-[13px]">{error}</span>}
        {owner && (
          <span className="text-[13px]">
            <Link href={`/emails?record=${recordId}`} className="font-medium underline hover:text-on-surface">
              See it in the email log
            </Link>
            {!cancelled && " — a retry may still be in progress."}
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
