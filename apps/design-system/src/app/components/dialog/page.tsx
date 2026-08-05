import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
        <DocLead>Import the parts and piece them together.</DocLead>
        <CodeBlock
          code={`import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
          <DocLead>Contains content to be rendered when the dialog is open, including a built-in close button.</DocLead>
          <ApiTable
            rows={[
              { prop: "onOpenAutoFocus", type: "(event: Event) => void" },
              { prop: "onCloseAutoFocus", type: "(event: Event) => void" },
              { prop: "onEscapeKeyDown", type: "(event: KeyboardEvent) => void" },
              { prop: "onPointerDownOutside", type: "(event: PointerDownOutsideEvent) => void" },
            ]}
          />
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
