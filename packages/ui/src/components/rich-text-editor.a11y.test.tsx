import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { RichTextContent, RichTextEditor } from "./rich-text-editor";

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

describe("RichTextContent a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <RichTextContent html="<p>Payment due within <strong>14 days</strong> of invoice date. See our <a href='#'>full policy</a>.</p>" />,
    );
    await expectNoA11yViolations(container);
  });
});
