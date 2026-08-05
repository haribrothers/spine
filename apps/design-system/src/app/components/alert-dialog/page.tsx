import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function AlertDialogPage() {
  return (
    <div>
      <DocTitle>AlertDialog</DocTitle>
      <DocLead>
        A modal dialog that interrupts the user with important content and expects a response
        — used specifically for critical/destructive actions (voiding an invoice, deleting a
        station) that can't be undone. Unlike Dialog, always renders an explicit Cancel action
        alongside the primary one.
      </DocLead>

      <ComponentPreview>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="danger">Delete station</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this station?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="secondary">Cancel</Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button variant="danger">Delete</Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Focus is trapped and automatically managed.",
            "Can be controlled or uncontrolled.",
            "Requires an explicit AlertDialogAction or AlertDialogCancel choice — the overlay does not close on outside click, unlike Dialog.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@spine/ui";

export default () => (
  <AlertDialog>
    <AlertDialogTrigger />
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle />
        <AlertDialogDescription />
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel />
        <AlertDialogAction />
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "open", type: "boolean" },
            { prop: "onOpenChange", type: "(open: boolean) => void" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="danger">Delete station</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete this station?</AlertDialogTitle>
      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel asChild>
        <Button variant="secondary">Cancel</Button>
      </AlertDialogCancel>
      <AlertDialogAction asChild>
        <Button variant="danger">Delete</Button>
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`}
        >
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="danger">Delete station</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this station?</AlertDialogTitle>
                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button variant="secondary">Cancel</Button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button variant="danger">Delete</Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Adheres to the{" "}
          <a href="https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/" className="text-primary underline underline-offset-2">
            WAI-ARIA Alert and Message Dialogs
          </a>{" "}
          pattern.
        </DocLead>
        <KeyboardTable
          rows={[
            { keys: "Tab", description: "Moves focus to the next focusable element." },
            { keys: "Esc", description: "Closes the dialog (same as AlertDialogCancel)." },
          ]}
        />
      </DocSection>
    </div>
  );
}
