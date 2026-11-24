"use client";

import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, ScanText } from "lucide-react";
import { Button, cn } from "@spine/ui";
import { aiPausedMessage } from "@spine/shared";
import { AiActionButton } from "../../../components/ai-action-button";
import { AiUnavailableNotice } from "../../../components/ai-unavailable-notice";
import { PHOTO_OR_PDF_ACCEPT } from "../../../lib/upload-types";
import { useT } from "../../../lib/i18n";

export type BillReadState =
  | { status: "idle" }
  | { status: "working"; fileName: string }
  | { status: "done"; fileName: string; readMs: number; asImage: boolean }
  | { status: "failed"; fileName: string | null; message: string; canRetry: boolean };

/**
 * US-AI-08 — the strip at the top of the bill's header card: "Read from
 * document" (choose or drop the vendor's PDF or photo), "Reading…" with
 * "Cancel" while AI works, what was read and how long it took, or "AI
 * didn't answer" with "Try again" (US-AI-07). While this month's budget
 * is used up the button shows disabled, with why (US-AI-04).
 */
export function BillAiReader({
  state,
  pausedUntil,
  attachedNote,
  onChoose,
  onCancel,
  onRetry,
}: {
  state: BillReadState;
  pausedUntil: string | null;
  /** "attached to this bill" or, before the bill is saved, "attached when you save". */
  attachedNote: string;
  onChoose: (file: File) => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const choose = () => input.current?.click();
  const working = state.status === "working";

  if (state.status === "failed" && state.canRetry) {
    return (
      <div className="sm:col-span-2 xl:col-span-4">
        <AiUnavailableNotice message={state.message} detail={state.fileName ? t("vendorBills.aiReader.attachedEitherWay", { fileName: state.fileName }) : undefined} onRetry={onRetry} />
      </div>
    );
  }

  const done = state.status === "done";
  const title = done ? state.fileName : working ? t("vendorBills.aiReader.reading", { fileName: state.fileName }) : t("vendorBills.aiReader.readWithAi");
  const meta = done
    ? t("vendorBills.aiReader.readMeta", { count: Math.max(1, Math.round(state.readMs / 1000)), attachedNote })
    : working
      ? t("vendorBills.aiReader.workingMeta")
      : t("vendorBills.aiReader.idleMeta");
  const Icon = done ? (state.asImage ? ImageIcon : FileText) : ScanText;

  return (
    <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-4">
      {state.status === "failed" && <AiUnavailableNotice message={state.message} />}
      <div
        data-testid="bill-ai-reader"
        onDragOver={(e) => {
          if (working || pausedUntil) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && !working && !pausedUntil) onChoose(file);
        }}
        className={cn("flex flex-wrap items-center gap-3 rounded-md border border-dashed px-3 py-2.5", dragging ? "border-primary bg-info-bg" : "border-border-strong")}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-on-surface-muted" aria-hidden>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-on-surface">{title}</p>
          <p className="text-[12.5px] text-on-surface-muted">{pausedUntil ? aiPausedMessage(pausedUntil) : meta}</p>
        </div>
        {done ? (
          <Button type="button" variant="secondary" size="sm" onClick={choose}>
            <ScanText size={14} aria-hidden />
            {t("vendorBills.aiReader.readAnother")}
          </Button>
        ) : (
          <AiActionButton label={t("vendorBills.aiReader.readFromDocument")} workingLabel={t("vendorBills.aiReader.readingButton")} working={working} disabled={Boolean(pausedUntil)} onClick={choose} onCancel={onCancel} />
        )}
        <input
          ref={input}
          type="file"
          accept={PHOTO_OR_PDF_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label={t("vendorBills.aiReader.chooseFile")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onChoose(file);
          }}
        />
      </div>
    </div>
  );
}
