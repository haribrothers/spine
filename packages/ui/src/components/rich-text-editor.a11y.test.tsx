import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { RichTextContent, RichTextEditor, type RichTextEditorHandle } from "./rich-text-editor";

describe("RichTextEditor a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <RichTextEditor
        value="<p>Payment due within <strong>14 days</strong> of invoice date.</p>"
        onValueChange={() => {}}
        placeholder="Terms & conditions…"
      />,
    );
    // Tiptap mounts its editor instance asynchronously (immediatelyRender: false).
    await waitFor(() => {
      expect(container.querySelector('[contenteditable="true"]')).toBeTruthy();
    });
    await expectNoA11yViolations(container);
  });

  it("keeps the placeholder inside the box when empty (US-QUO-35)", async () => {
    const { container } = render(<RichTextEditor value="" onValueChange={() => {}} placeholder="Payment terms, validity, etc…" />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="rich-text-placeholder"]')).toBeTruthy();
    });
    const placeholder = container.querySelector('[data-testid="rich-text-placeholder"]')!;
    expect(placeholder.parentElement?.className).toContain("relative");
    expect(placeholder.textContent).toBe("Payment terms, validity, etc…");
  });

  it("has no violations when disabled", async () => {
    const { container } = render(
      <RichTextEditor value="<p>Notes</p>" onValueChange={() => {}} disabled />,
    );
    await waitFor(() => {
      expect(container.querySelector(".ProseMirror")).toBeTruthy();
    });
    await expectNoA11yViolations(container);
  });
});

describe("RichTextEditor insertText (D-189)", () => {
  it("puts text at the cursor and stays accessible", async () => {
    let handle: RichTextEditorHandle | null = null;
    let html = "<p>Hi</p>";
    const { container } = render(<RichTextEditor value={html} onValueChange={(v) => (html = v)} onReady={(h) => (handle = h)} aria-label="Message" />);
    await waitFor(() => expect(handle).not.toBeNull());
    handle!.insertText(" {customer_name}");
    await waitFor(() => expect(html).toContain("{customer_name}"));
    expect(container.querySelector('[role="textbox"][aria-label="Message"][aria-multiline="true"]')).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});

describe("RichTextContent a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <RichTextContent html="<p>Payment due within <strong>14 days</strong> of invoice date. See our <a href='#'>full policy</a>.</p>" />,
    );
    await expectNoA11yViolations(container);
  });
});
