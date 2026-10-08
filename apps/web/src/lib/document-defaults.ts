"use client";

import { useEffect } from "react";
import { resolveDocumentLayout, type DocumentLayout } from "@spine/shared";
import { apiClient } from "./api-client";

/** Plain text (one paragraph per line) as the rich-text editor's HTML. */
export function textToHtml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\r?\n/)
    .filter((line, i, all) => line.trim() || (i > 0 && i < all.length - 1))
    .map((line) => `<p>${escape(line)}</p>`)
    .join("");
}

/** True for "" and an empty editor's "<p></p>". */
function isBlank(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim() === "";
}

/**
 * US-SET-18 — a new quote or invoice starts with Settings › Documents'
 * default terms and notes; anything already typed stays.
 */
export function useDocumentDefaults(type: "quote" | "invoice", isNew: boolean, setNotes: (fn: (current: string) => string) => void, setTerms: (fn: (current: string) => string) => void) {
  useEffect(() => {
    if (!isNew) return;
    apiClient
      .get<{ value: DocumentLayout | null }>("/org/settings/document_layout")
      .then((res) => {
        const layout = resolveDocumentLayout(res.value, type);
        if (layout.notes) setNotes((current) => (isBlank(current) ? textToHtml(layout.notes) : current));
        if (layout.terms) setTerms((current) => (isBlank(current) ? textToHtml(layout.terms) : current));
      })
      .catch(() => {});
    // Only once, when the draft is created.
  }, [isNew, type]);
}
