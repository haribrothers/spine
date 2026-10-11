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
import { UseConfirmDemo } from "./use-confirm-demo";

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
            "AlertDialogAction is primary by default; pass variant=\"danger\" only when the action deletes, voids, deactivates or removes something (D-058).",
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
            { prop: "AlertDialogAction variant", type: '"primary" | "danger"', defaultValue: '"primary"' },
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

      <DocSection id="use-confirm" title="useConfirm — ask before a major action">
        <DocLead>
          D-218: issuing, recording or voiding a document, deleting or removing something, emailing a customer and bulk
          changes always ask first. <code>useConfirm()</code> gives a <code>confirm(options)</code> that opens this dialog and
          resolves <code>true</code> when the verb is pressed, <code>false</code> on Go back, Esc or a click outside. Say what
          happens to the person&apos;s data and whether it can be undone; the verb is primary unless it deletes, voids or
          removes (<code>danger</code>).
        </DocLead>
        <ComponentPreview
          code={`const { confirm, dialog } = useConfirm();

async function record() {
  const ok = await confirm({
    title: "Record this bill?",
    description: "… is posted to your books as owed. After that it can't be edited — only voided.",
    confirmLabel: "Record bill",
  });
  if (!ok) return;
  // record it
}

return (
  <>
    <Button onClick={record}>Record</Button>
    {dialog}
  </>
);`}
        >
          <UseConfirmDemo />
        </ComponentPreview>
        <ApiTable
          rows={[
            { prop: "title", type: "string", description: "A question: \"Record this bill?\"" },
            { prop: "description", type: "ReactNode", description: "What happens to the person's data, and whether it can be undone." },
            { prop: "confirmLabel", type: "string", description: "The verb on the button: \"Record bill\"." },
            { prop: "cancelLabel", type: "string", defaultValue: '"Go back"' },
            { prop: "danger", type: "boolean", defaultValue: "false", description: "A red verb, for deleting, voiding or removing." },
          ]}
        />
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
