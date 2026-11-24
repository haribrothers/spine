import { Sparkles } from "lucide-react";
import { t } from "../lib/i18n";

/** US-AI-06 (D-166) — " · filled in with AI" after an Activity entry saved from AI suggestions; who and when stay on the line below. */
export function AiFilledMark() {
  return (
    <>
      {" · "}
      <span className="inline-flex items-center gap-1 font-normal" data-testid="ai-filled">
        <Sparkles size={12} aria-hidden className="text-primary" />
        {t("common.aiFilledMark.label")}
      </span>
    </>
  );
}
