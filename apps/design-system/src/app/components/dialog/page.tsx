import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function DialogPage() {
  return (
    <div>
      <DocTitle>Dialog</DocTitle>
      <DocLead>A focused, centered task — e.g. confirming a void. For a longer side-anchored flow, use Drawer instead.</DocLead>

      <DocSection id="default" title="Default">
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
      <Button variant="secondary">Cancel</Button>
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
                <Button variant="secondary">Cancel</Button>
                <Button variant="danger">Void invoice</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
