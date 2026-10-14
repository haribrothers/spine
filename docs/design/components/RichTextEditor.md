# RichTextEditor

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/rich-text-editor.tsx` · **Doc page:** `apps/design-system/src/app/components/rich-text-editor/page.tsx`

Basic rich text — bold, italic, bullet/numbered lists, links. For a quote's notes or terms & conditions, and the message of a customer email (Settings › Emails and the "Send" dialogs, D-189), where plain text reads flat but a full document editor would be overkill.

## Import

```tsx
import { RichTextEditor, RichTextContent } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `value` | string | — |
| `onValueChange` | (html: string) => void | — |
| `placeholder` | string | — |
| `disabled` | boolean | false |
| `error` | boolean | false |
| `id / aria-invalid / aria-required / aria-describedby` | passed through to the editable region | — |
| `aria-label` | string — the field's label; the editable region is a `textbox`, and a `<label>` can't name a contenteditable | — |
| `onReady` | (handle: `RichTextEditorHandle`) => void — `insertText(text)` puts text at the cursor and focuses the editor; `focus()` | — |
| `onFocus` | () => void | — |
| `html` | string | — |
| `className` | string | — |

## Rules and behaviour

- Bold, italic, bullet lists, numbered lists, and links — nothing more. Headings, tables, and images are deliberately out of scope.
- Built on Tiptap (MIT-licensed) — a schema-constrained editor, not a raw contenteditable, so pasted or typed markup can never escape the allowed set of tags.
- Stores and emits plain HTML (not Markdown or a JSON document), matching the plain `text` columns it fills (e.g. a quote's notes/termsAndConditions) and the PDF renderer that lays it out.
- The placeholder sits inside the box, over the empty editor (its wrapper is positioned; US-QUO-35 fixed it landing at the bottom of the page).
- An "Insert" menu outside the editor (e.g. email placeholders) uses `onReady`'s `insertText`; its buttons should `preventDefault` on mouse down so the editor keeps its cursor.
- RichTextContent, a companion read-only component, renders that stored HTML back out for display — sanitized via DOMPurify at render time, since the source column has no server-side HTML validation and could in principle hold anything.

## Exports

`RichTextEditorProps` · `RichTextEditorHandle` · `RichTextEditor` · `RichTextContent`

## Accessibility

Automated check: `packages/ui/src/components/rich-text-editor.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
