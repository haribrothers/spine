import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Textarea,
} from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { ApiTable, DocLead, DocSection, DocSubsection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";
import { CodeBlock } from "@/components/code-block";

export default function DialogPage() {
  return (
    <div>
      <DocTitle>Dialog</DocTitle>
      <DocLead>
        A window overlaid on the page, rendering content that requires focused attention. A
        focused, centered task — e.g. confirming a void. For a longer side-anchored flow, use
        Drawer instead.
      </DocLead>

      <ComponentPreview>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger">Void invoice</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Void this invoice?</DialogTitle>
              <DialogDescription>
                This cannot be undone. A reversing entry will be posted to the ledger.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <p className="text-[13px] text-on-surface-muted">No content needed for a bare confirmation.</p>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button variant="danger">Void invoice</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Full keyboard navigation.",
            "Supports modal and non-modal modes.",
            "Manages screen reader announcements with Title and Description components.",
            "Focus is fully managed and customizable.",
            "The overlay dims the page and blocks interaction while open.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <DocLead>
          Import the parts and piece them together. <code>DialogHeader</code> and{" "}
          <code>DialogFooter</code> are fixed to the top/bottom and never scroll — only{" "}
          <code>DialogBody</code>, the region between them, scrolls when its content grows
          past the dialog&apos;s own height cap. This mirrors Drawer&apos;s exact
          header/body/footer split (see Drawer&apos;s own docs).
        </DocLead>
        <CodeBlock
          code={`import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@spine/ui";

export default () => (
  <Dialog>
    <DialogTrigger />
    <DialogContent>
      <DialogHeader>
        <DialogTitle />
        <DialogDescription />
      </DialogHeader>
      <DialogBody>
        {/* form fields, lists, anything that might outgrow the dialog */}
      </DialogBody>
      <DialogFooter>
        <DialogClose />
      </DialogFooter>
    </DialogContent>
  </Dialog>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <DocSubsection id="dialog-root" title="Dialog">
          <DocLead>Contains all the parts of a dialog.</DocLead>
          <ApiTable
            rows={[
              { prop: "open", type: "boolean" },
              { prop: "onOpenChange", type: "(open: boolean) => void" },
              { prop: "modal", type: "boolean", defaultValue: "true" },
            ]}
          />
        </DocSubsection>
        <DocSubsection id="dialog-trigger" title="DialogTrigger">
          <DocLead>The button that opens the dialog.</DocLead>
          <ApiTable rows={[{ prop: "asChild", type: "boolean", defaultValue: "false" }]} />
        </DocSubsection>
        <DocSubsection id="dialog-content" title="DialogContent">
          <DocLead>
            A height-bounded flex column (<code>max-h-[85vh]</code> at <code>size=&quot;md&quot;</code>, a
            fixed <code>h-[min(720px,85vh)]</code> at <code>size=&quot;lg&quot;</code>) containing a built-in
            close button. Compose <code>DialogHeader</code>/<code>DialogBody</code>/<code>DialogFooter</code>{" "}
            inside it so only the body scrolls — a dialog that builds its own internal layout
            instead (e.g. a settings dialog with a nav pane) can skip all three and manage its
            own <code>h-full</code> flex column directly.
          </DocLead>
          <ApiTable
            rows={[
              { prop: "size", type: '"md" | "lg" | "xl"', defaultValue: '"md"' },
              { prop: "onOpenAutoFocus", type: "(event: Event) => void" },
              { prop: "onCloseAutoFocus", type: "(event: Event) => void" },
              { prop: "onEscapeKeyDown", type: "(event: KeyboardEvent) => void" },
              { prop: "onPointerDownOutside", type: "(event: PointerDownOutsideEvent) => void" },
            ]}
          />
        </DocSubsection>
        <DocSubsection id="dialog-body" title="DialogBody">
          <DocLead>
            The only scrollable region between <code>DialogHeader</code> and{" "}
            <code>DialogFooter</code> (<code>flex-1 overflow-y-auto</code>). Owns its own
            padding, matching <code>DrawerBody</code> exactly — reach for it whenever a
            dialog has a footer AND content that could plausibly outgrow the dialog&apos;s
            height cap (a form, a list, a table). A bare confirmation with no footer doesn&apos;t
            need it.
          </DocLead>
        </DocSubsection>
        <DocSubsection id="dialog-title" title="DialogTitle / DialogDescription">
          <DocLead>An accessible name and description read by screen readers when the dialog opens.</DocLead>
        </DocSubsection>
        <DocSubsection id="dialog-close" title="DialogClose">
          <DocLead>The button that closes the dialog.</DocLead>
          <ApiTable rows={[{ prop: "asChild", type: "boolean", defaultValue: "false" }]} />
        </DocSubsection>
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocSubsection id="confirm-destructive-action" title="Confirming a destructive action">
          <DocLead>
            For an action that can't be undone (voiding an invoice, deleting a station),
            prefer AlertDialog instead — it always renders an explicit Cancel action.
            Dialog is the right choice for a routine focused task like this one.
          </DocLead>
          <ComponentPreview
            code={`<Dialog>
  <DialogTrigger asChild>
    <Button variant="danger">Void invoice</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Void this invoice?</DialogTitle>
      <DialogDescription>
        This cannot be undone. A reversing entry will be posted to the ledger.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="secondary">Cancel</Button>
      </DialogClose>
      <Button variant="danger">Void invoice</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`}
          >
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="danger">Void invoice</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Void this invoice?</DialogTitle>
                  <DialogDescription>
                    This cannot be undone. A reversing entry will be posted to the ledger.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button variant="danger">Void invoice</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </ComponentPreview>
        </DocSubsection>

        <DocSubsection id="scrollable-body" title="Scrollable body, pinned header and footer">
          <DocLead>
            Wrap form content in <code>DialogBody</code> so a tall form scrolls internally
            while the title and action buttons stay pinned in view — the footer never gets
            pushed off-screen no matter how much content the body holds.
          </DocLead>
          <ComponentPreview
            code={`<Dialog>
  <DialogTrigger asChild>
    <Button variant="secondary">Record a payment</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Record a payment</DialogTitle>
      <DialogDescription>Allocate it across outstanding invoices.</DialogDescription>
    </DialogHeader>
    <DialogBody className="flex flex-col gap-4">
      <FormField label="Notes">
        {(field) => <Textarea {...field} rows={8} placeholder="Long content that needs to scroll…" />}
      </FormField>
    </DialogBody>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="secondary">Cancel</Button>
      </DialogClose>
      <Button>Record payment</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`}
          >
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Record a payment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record a payment</DialogTitle>
                  <DialogDescription>Allocate it across outstanding invoices.</DialogDescription>
                </DialogHeader>
                <DialogBody className="flex flex-col gap-4">
                  <FormField label="Notes">
                    {(field) => <Textarea {...field} rows={8} placeholder="Long content that needs to scroll…" />}
                  </FormField>
                </DialogBody>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button>Record payment</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </ComponentPreview>
        </DocSubsection>
      </DocSection>

      <DocSection id="sizes" title="Sizes">
        <DocLead>
          <code>size=&quot;lg&quot;</code> is a large, tall, unpadded panel for multi-pane content — e.g. a
          settings dialog with a left nav list and a right content pane. Panes are responsible for their
          own padding since the default padding is dropped at this size. <code>size=&quot;xl&quot;</code> is
          the roomier version Settings uses (US-SET-32): up to 1152 × 960 px — 90% of the window&apos;s height,
          keeping a 24px margin — and the whole screen below 768 px, where the content should show one pane
          at a time.
        </DocLead>
        <ComponentPreview
          code={`<Dialog>
  <DialogTrigger asChild>
    <Button variant="secondary">Open settings</Button>
  </DialogTrigger>
  <DialogContent size="lg">
    <div className="flex h-full">
      <div className="w-56 shrink-0 border-r border-border p-4">Nav</div>
      <div className="flex-1 overflow-y-auto p-6">Content</div>
    </div>
  </DialogContent>
</Dialog>`}
        >
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open settings</Button>
            </DialogTrigger>
            <DialogContent size="lg">
              <div className="flex h-full">
                <div className="w-56 shrink-0 border-r border-border p-4 text-[13px] text-on-surface-muted">
                  Nav
                </div>
                <div className="flex-1 overflow-y-auto p-6 text-[13px] text-on-surface-muted">Content</div>
              </div>
            </DialogContent>
          </Dialog>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Adheres to the{" "}
          <a
            href="https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/"
            className="text-primary underline underline-offset-2"
          >
            WAI-ARIA Dialog (Modal)
          </a>{" "}
          design pattern.
        </DocLead>
        <DocSubsection id="dialog-keyboard-interactions" title="Keyboard Interactions">
          <KeyboardTable
            rows={[
              { keys: "Space", description: "Opens/closes the dialog when the trigger is focused." },
              { keys: "Enter", description: "Opens/closes the dialog when the trigger is focused." },
              { keys: "Tab", description: "Moves focus to the next focusable element within the dialog." },
              { keys: "Shift+Tab", description: "Moves focus to the previous focusable element within the dialog." },
              { keys: "Esc", description: "Closes the dialog and returns focus to the trigger." },
            ]}
          />
        </DocSubsection>
      </DocSection>
    </div>
  );
}
