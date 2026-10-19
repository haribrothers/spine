"use client";

import { Extension, useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import DOMPurify from "dompurify";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { cn } from "../lib/cn";
import { Toolbar, ToolbarButton, ToolbarSeparator } from "./toolbar";

export interface RichTextEditorProps {
  /** HTML string — matches every existing `text` column this replaces (e.g. quotes.notes/termsAndConditions), no schema change needed. `""`/`undefined` renders an empty editor. */
  value?: string;
  onValueChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  /** Passed through to the underlying contenteditable region for FormField's render-prop wiring (id, aria attributes, required). */
  id?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  "aria-describedby"?: string;
  /** The editable region's accessible name — a `<label>` can't name a contenteditable, so pass the field's label here. */
  "aria-label"?: string;
  /** Gives the parent a way to put text at the cursor, e.g. an email placeholder from an "Insert" menu (US-SET-21). */
  onReady?: (handle: RichTextEditorHandle) => void;
  /** Called when the editable region gets focus. */
  onFocus?: () => void;
  /**
   * Strings to mark wherever they appear, on screen only — e.g. the details
   * Spine filled into an email (US-AI-11). The HTML the editor emits is
   * unchanged, and a marked string someone edits loses its mark.
   */
  highlights?: readonly string[];
}

/** The look of a highlighted string: a tint with an underline, so it isn't colour alone against the text around it. */
const HIGHLIGHT_CLASS = "rounded-[3px] bg-info-bg px-0.5 text-inherit shadow-[inset_0_-1.5px_0_var(--color-primary)]";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches any of the strings as a whole word or phrase, the longest first; null when there's nothing to match. */
function highlightPattern(highlights: readonly string[] | undefined): RegExp | null {
  const words = [...new Set((highlights ?? []).map((h) => h.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  return words.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`, "gu") : null;
}

const highlightKey = new PluginKey<DecorationSet>("spineHighlights");

function highlightDecorations(doc: ProseMirrorNode, pattern: RegExp | null): DecorationSet {
  if (!pattern) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const match of node.text.matchAll(pattern)) {
      decorations.push(Decoration.inline(pos + match.index, pos + match.index + match[0].length, { class: HIGHLIGHT_CLASS, "data-highlight": "" }));
    }
  });
  return DecorationSet.create(doc, decorations);
}

/** `highlights` as ProseMirror decorations, recomputed when the text or the list changes. */
function highlightsExtension(pattern: { current: RegExp | null }) {
  return Extension.create({
    name: "spineHighlights",
    addProseMirrorPlugins() {
      return [
        new Plugin<DecorationSet>({
          key: highlightKey,
          state: {
            init: (_, state) => highlightDecorations(state.doc, pattern.current),
            apply: (tr, old, _, state) => (tr.docChanged || tr.getMeta(highlightKey) ? highlightDecorations(state.doc, pattern.current) : old),
          },
          props: { decorations: (state) => highlightKey.getState(state) },
        }),
      ];
    },
  });
}

/** What `onReady` hands the parent. */
export interface RichTextEditorHandle {
  /** Inserts plain text at the cursor (or the end, if the editor never had focus) and focuses the editor. */
  insertText: (text: string) => void;
  focus: () => void;
}

/**
 * Basic rich text — bold, italic, bullet/numbered lists, links. Built on
 * Tiptap (MIT-licensed, the common choice alongside Radix-based design
 * systems) rather than a heavier block editor (headings/tables/images):
 * quote notes/terms need to read well, not become a document-authoring
 * surface, and a constrained toolbar keeps every button meaningfully used
 * rather than mostly-empty chrome. Stores/emits HTML (not Markdown or a
 * JSON doc), since every consumer today (quotes.notes/termsAndConditions)
 * is a plain `text` column and the quote PDF renderer needs to parse HTML
 * anyway to lay it out — see `apps/api/src/modules/pdf/quote-pdf.template.tsx`
 * for that consumer.
 */
export function RichTextEditor({
  value,
  onValueChange,
  placeholder,
  disabled,
  error,
  className,
  id,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  onReady,
  onFocus,
  highlights,
}: RichTextEditorProps) {
  const pattern = useRef<RegExp | null>(highlightPattern(highlights));
  const highlightKeyText = (highlights ?? []).join("\u0000");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // headings are out of scope for "basic formatting" per this component's own doc comment
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      highlightsExtension(pattern),
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        ...(ariaInvalid !== undefined ? { "aria-invalid": String(ariaInvalid) } : {}),
        ...(ariaRequired !== undefined ? { "aria-required": String(ariaRequired) } : {}),
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
        // Named, it's announced as a multi-line text box.
        ...(ariaLabel ? { "aria-label": ariaLabel, role: "textbox", "aria-multiline": "true" } : {}),
        class: "min-h-24 px-2.5 py-2 text-[14px] text-on-surface focus:outline-none [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline",
      },
    },
    onUpdate: ({ editor: current }) => onValueChange(current.getHTML()),
    onFocus: () => onFocus?.(),
    // Tiptap's SSR guard — this component is always "use client", but the
    // editor's own first render still happens before hydration settles;
    // immediatelyRender: false avoids a hydration mismatch warning that
    // otherwise fires in Next.js App Router specifically (documented
    // Tiptap/Next.js interaction, not specific to this codebase).
    immediatelyRender: false,
  });

  // Keep the editor in sync when `value` changes from OUTSIDE this
  // component (e.g. loading a different quote into the same mounted form)
  // — onUpdate above only flows changes the editor itself produced, so an
  // external value swap needs this explicit sync or the editor would keep
  // showing stale content.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  // A new list of highlights redraws them without touching the text.
  useEffect(() => {
    pattern.current = highlightPattern(highlightKeyText ? highlightKeyText.split("\u0000") : []);
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(highlightKey, true).setMeta("preventUpdate", true).setMeta("addToHistory", false));
  }, [highlightKeyText, editor]);

  useEffect(() => {
    if (!editor || !onReady) return;
    onReady({
      // Inserted as a text node, so braces and angle brackets stay literal.
      insertText: (text) => editor.chain().focus(undefined, { scrollIntoView: false }).insertContent({ type: "text", text }).run(),
      focus: () => editor.commands.focus(undefined, { scrollIntoView: false }),
    });
  }, [editor, onReady]);

  return (
    <div
      className={cn(
        "rounded-sm border bg-surface transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-surface",
        error ? "border-overdue" : "border-border-strong",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <RichTextToolbar editor={editor} disabled={disabled} />
      {/* US-QUO-35: "relative" keeps the placeholder inside the box (it used to land at the bottom of the page). */}
      <div className="relative border-t border-border">
        {editor && !editor.getText() && placeholder && (
          <p className="pointer-events-none absolute left-0 top-0 px-2.5 py-2 text-[14px] text-on-surface-muted" data-testid="rich-text-placeholder">{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function RichTextToolbar({ editor, disabled }: { editor: Editor | null; disabled?: boolean }) {
  if (!editor) return <div className="h-10" />; // reserves toolbar height before the editor instance is ready, avoiding layout shift
  return (
    <Toolbar className="rounded-b-none border-0 border-b-0 bg-transparent p-1">
      <ToolbarButton
        type="button"
        disabled={disabled}
        aria-label="Bold"
        aria-pressed={editor.isActive("bold")}
        data-state={editor.isActive("bold") ? "on" : "off"}
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn(editor.isActive("bold") && "bg-surface-sunken text-primary")}
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        type="button"
        disabled={disabled}
        aria-label="Italic"
        aria-pressed={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn(editor.isActive("italic") && "bg-surface-sunken text-primary")}
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        type="button"
        disabled={disabled}
        aria-label="Bulleted list"
        aria-pressed={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn(editor.isActive("bulletList") && "bg-surface-sunken text-primary")}
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        type="button"
        disabled={disabled}
        aria-label="Numbered list"
        aria-pressed={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cn(editor.isActive("orderedList") && "bg-surface-sunken text-primary")}
      >
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        type="button"
        disabled={disabled}
        aria-label={editor.isActive("link") ? "Remove link" : "Add link"}
        aria-pressed={editor.isActive("link")}
        onClick={() => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const url = window.prompt("Link URL");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        className={cn(editor.isActive("link") && "bg-surface-sunken text-primary")}
      >
        <LinkIcon size={14} />
      </ToolbarButton>
    </Toolbar>
  );
}

/**
 * Renders RichTextEditor's stored HTML for read-only display (e.g. a quote
 * detail page). Sanitized via DOMPurify at render time — the stored HTML
 * is NOT guaranteed to have only ever come from this editor's own output:
 * the columns this fills (e.g. `quotes.notes`/`termsAndConditions`) are
 * plain `z.string()` in their zod schema with no server-side HTML
 * validation, so a direct `POST`/`PUT` to the API (bypassing this editor
 * entirely) could write arbitrary HTML/script. Restricted to a small
 * allowlist matching exactly what the editor's own toolbar can produce
 * (bold/italic/lists/links/paragraphs/line breaks) — nothing else is a
 * legitimate output of this component, so nothing else needs to render.
 */
const ALLOWED_TAGS = ["p", "strong", "em", "ul", "ol", "li", "a", "br"];
const ALLOWED_ATTR = ["href", "target", "rel"];

/** Wraps each match of `pattern` in the sanitized HTML's text in a `<mark>`, leaving tags and attributes alone. */
function markHighlights(safeHtml: string, pattern: RegExp | null): string {
  if (!pattern) return safeHtml;
  const root = document.createElement("div");
  root.innerHTML = safeHtml;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  for (const text of texts) {
    const value = text.data;
    const matches = [...value.matchAll(pattern)];
    if (!matches.length) continue;
    const parts = document.createDocumentFragment();
    let at = 0;
    for (const match of matches) {
      parts.append(value.slice(at, match.index));
      const mark = document.createElement("mark");
      mark.className = HIGHLIGHT_CLASS;
      mark.dataset.highlight = "";
      mark.textContent = match[0];
      parts.append(mark);
      at = match.index + match[0].length;
    }
    parts.append(value.slice(at));
    text.replaceWith(parts);
  }
  return root.innerHTML;
}

export function RichTextContent({ html, className, highlights }: { html: string; className?: string; highlights?: readonly string[] }) {
  const highlightKeyText = (highlights ?? []).join("\u0000");
  const safeHtml = useMemo(() => {
    if (typeof window === "undefined") return ""; // DOMPurify needs a DOM; server-render renders nothing rather than unsanitized markup
    const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
    return markHighlights(clean, highlightPattern(highlightKeyText ? highlightKeyText.split("\u0000") : []));
  }, [html, highlightKeyText]);

  return (
    <div
      className={cn(
        "text-[14px] text-on-surface [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
